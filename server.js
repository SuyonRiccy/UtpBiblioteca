// ============================================================
// Servidor de la Biblioteca Virtual UTP (IHM - PA3)
// Node + Express, SIN base de datos: los datos viven en /data/*.json
// ============================================================
const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());                                   // leer JSON del body
app.use(express.static(path.join(__dirname, 'public')));   // sirve el HTML/CSS/JS

// ---------- Utilidades para leer/guardar los archivos JSON ----------
const ruta = (archivo) => path.join(__dirname, 'data', archivo);
const leer = (archivo) => JSON.parse(fs.readFileSync(ruta(archivo), 'utf8'));
const guardar = (archivo, datos) => fs.writeFileSync(ruta(archivo), JSON.stringify(datos, null, 2));

// Quita tildes y pasa a minúsculas: "Administración" -> "administracion"
const norm = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

// Distancia de Levenshtein: cuántas letras hay que cambiar para que dos textos sean iguales
function distancia(a, b) {
  const m = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j++) m[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      m[i][j] = Math.min(m[i - 1][j] + 1, m[i][j - 1] + 1, m[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return m[a.length][b.length];
}

// "¿Quisiste decir...?": el título más parecido a lo que escribió el usuario
function sugerenciaPara(q) {
  const buscado = norm(q);
  if (!buscado) return null;
  let mejor = null, mejorD = Infinity;
  for (const l of leer('libros.json')) {
    const t = norm(l.titulo);
    const d = Math.min(distancia(buscado, t), distancia(buscado, t.slice(0, buscado.length)));
    if (d < mejorD) { mejorD = d; mejor = l.titulo; }
  }
  return mejorD <= Math.max(4, Math.floor(buscado.length / 2)) ? mejor : null;
}

// ---------- Horario de la biblioteca (en minutos desde medianoche) ----------
function horarioDe(fecha) {
  const dia = new Date(fecha + 'T00:00:00').getDay(); // 0 = domingo
  if (dia === 0) return null;                  // domingo cerrado
  if (dia === 6) return [9 * 60, 13 * 60];     // sábado 9:00 - 13:00
  return [8 * 60, 18 * 60];                    // lunes a viernes 8:00 - 18:00
}
const aMinutos = (hhmm) => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; };
const aHora = (min) => String(Math.floor(min / 60)).padStart(2, '0') + ':' + String(min % 60).padStart(2, '0');
const hoy = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
const fechaValida = (f) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(f || '')) return false;
  const [anio, mes, dia] = f.split('-').map(Number);
  const fecha = new Date(Date.UTC(anio, mes - 1, dia));
  return fecha.getUTCFullYear() === anio && fecha.getUTCMonth() === mes - 1 && fecha.getUTCDate() === dia;
};

// Devuelve un error con texto explicativo (no solo "inválido") y el campo afectado
const error = (res, estado, mensaje, campo) => res.status(estado).json({ error: mensaje, campo });

// ============================================================
// API: LIBROS
// ============================================================
app.get('/api/sugerencias', (req, res) => {
  const q = norm(req.query.q);
  if (q.length < 2) return res.json([]);
  const titulos = leer('libros.json').filter((l) => norm(l.titulo).includes(q) || norm(l.autores).includes(q)).map((l) => l.titulo);
  res.json(titulos.slice(0, 5));
});

app.get('/api/libros', (req, res) => {
  const { q, formato, facultad, anio, enLinea } = req.query;
  const lista = (v) => (v ? String(v).split(',') : []);   // "Libro,Revista" -> ["Libro","Revista"]
  const formatos = lista(formato), facultades = lista(facultad);
  const rangosAnio = lista(anio).map((valor) => {
    const rango = valor.match(/^(\d{4})-(\d{4})$/);
    if (rango) return { desde: Number(rango[1]), hasta: Number(rango[2]) };
    const exacto = Number(valor);
    return Number.isInteger(exacto) ? { desde: exacto, hasta: exacto } : null;
  }).filter(Boolean);
  let libros = leer('libros.json');
  if (q) { const n = norm(q); libros = libros.filter((l) => norm(l.titulo + ' ' + l.autores + ' ' + l.facultad).includes(n)); }
  if (formatos.length) libros = libros.filter((l) => formatos.includes(l.formato));
  if (facultades.length) libros = libros.filter((l) => facultades.includes(l.facultad));
  if (rangosAnio.length) libros = libros.filter((l) => rangosAnio.some(({ desde, hasta }) => l.anio >= desde && l.anio <= hasta));
  if (enLinea === 'true') libros = libros.filter((l) => l.enLinea);
  res.json({ total: libros.length, libros, sugerencia: libros.length ? null : sugerenciaPara(q) });
});

app.get('/api/libros/:id', (req, res) => {
  const libro = leer('libros.json').find((l) => l.id === Number(req.params.id));
  if (!libro) return error(res, 404, 'No encontramos ese recurso. Puede que haya sido retirado del catálogo.');
  const reservados = leer('reservas.json').filter((r) => r.tipo === 'libro' && r.libroId === libro.id).length;
  res.json({ ...libro, disponibles: Math.max(0, libro.ejemplares - reservados) });
});

// ============================================================
// API: SALAS
// ============================================================
// Una sala está ocupada si otra reserva de la misma sala y fecha se cruza con el horario pedido
function salaOcupada(salaId, fecha, ini, fin) {
  return leer('reservas.json').some((r) => r.tipo === 'sala' && r.salaId === salaId && r.fecha === fecha && ini < r.fin && r.ini < fin);
}

// Valida fecha/hora/duración/personas. Devuelve {error, campo} o {ini, fin}
function validarSala({ fecha, hora, duracion, personas }) {
  if (!fechaValida(fecha)) return { error: 'Elige una fecha. Usa el formato día/mes/año.', campo: 'fecha' };
  if (fecha < hoy()) return { error: 'La fecha ya pasó. Elige hoy o un día posterior.', campo: 'fecha' };
  const horario = horarioDe(fecha);
  if (!horario) return { error: 'La biblioteca está cerrada los domingos. Elige otro día.', campo: 'fecha' };
  if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(hora || '')) return { error: 'Elige una hora válida de inicio.', campo: 'hora' };
  const dur = Number(duracion);
  if (![1, 2, 3].includes(dur)) return { error: 'Elige una duración de 1, 2 o 3 horas.', campo: 'duracion' };
  const n = Number(personas);
  if (!Number.isInteger(n) || n < 2 || n > 10) return { error: 'Indica entre 2 y 10 personas.', campo: 'personas' };
  const ini = aMinutos(hora), fin = ini + dur * 60;
  if (ini < horario[0] || fin > horario[1])
    return { error: `Ese horario está fuera de atención. Ese día atendemos de ${aHora(horario[0])} a ${aHora(horario[1])}.`, campo: 'hora' };
  return { ini, fin, n };
}

app.get('/api/salas', (req, res) => {
  const v = validarSala(req.query);
  if (v.error) return error(res, 400, v.error, v.campo);
  const salas = leer('salas.json').map((s) => ({
    ...s,
    cabe: s.capacidad >= v.n,
    disponible: s.capacidad >= v.n && !salaOcupada(s.id, req.query.fecha, v.ini, v.fin)
  }));
  res.json({ salas, horario: aHora(v.ini) + ' – ' + aHora(v.fin) });
});

// ============================================================
// API: RESERVAS (libro físico o sala)
// ============================================================
const SEDES = ['Chiclayo', 'Trujillo'];
const FRANJAS = ['08:00 – 10:00', '10:00 – 12:00', '14:00 – 16:00'];

// La sesión del prototipo se identifica por el correo guardado en el navegador.
// No sustituye autenticación real, pero permite separar las reservas de cada demo.
app.get('/api/reservas', (req, res) => {
  const correo = String(req.query.usuario || '').trim().toLowerCase();
  if (!correo) return error(res, 400, 'Inicia sesión para consultar tus reservas.');
  const tipo = req.query.tipo;
  const reservas = leer('reservas.json').filter((r) =>
    r.usuario === correo && (!tipo || r.tipo === tipo) && (!r.fecha || r.fecha >= hoy())
  );
  res.json(reservas);
});

app.post('/api/reservas', (req, res) => {
  const b = req.body || {};
  const reservas = leer('reservas.json');
  const correo = String(b.usuario || '').trim().toLowerCase();
  if (!/^[^\s@]+@utp\.edu\.pe$/i.test(correo)) return error(res, 400, 'Inicia sesión con tu correo institucional.');

  if (b.tipo === 'libro') {
    const libro = leer('libros.json').find((l) => l.id === Number(b.libroId));
    if (!libro) return error(res, 404, 'No encontramos ese recurso.');
    if (!libro.fisico) return error(res, 400, 'Este recurso es solo digital. Puedes leerlo en línea.');
    if (!SEDES.includes(b.sede)) return error(res, 400, 'Elige la sede donde recogerás el ejemplar.', 'sede');
    if (!fechaValida(b.fecha) || b.fecha < hoy()) return error(res, 400, 'Elige una fecha de recojo de hoy en adelante.', 'fecha');
    if (!horarioDe(b.fecha)) return error(res, 400, 'La biblioteca está cerrada los domingos. Elige otro día.', 'fecha');
    if (!FRANJAS.includes(b.franja)) return error(res, 400, 'Elige una franja horaria.', 'franja');
    const usados = reservas.filter((r) => r.tipo === 'libro' && r.libroId === libro.id).length;
    if (usados >= libro.ejemplares) return error(res, 409, 'No quedan ejemplares disponibles. Prueba leerlo en línea o elige otro recurso.');
    const nueva = { id: Date.now(), tipo: 'libro', usuario: correo, libroId: libro.id, titulo: libro.titulo, sede: b.sede, fecha: b.fecha, franja: b.franja };
    reservas.push(nueva); guardar('reservas.json', reservas);
    return res.status(201).json(nueva);
  }

  if (b.tipo === 'sala') {
    const sala = leer('salas.json').find((s) => s.id === Number(b.salaId));
    if (!sala) return error(res, 404, 'No encontramos esa sala.');
    const v = validarSala(b);
    if (v.error) return error(res, 400, v.error, v.campo);
    const yaTieneSala = reservas.some((r) => r.tipo === 'sala' && r.usuario === correo && r.fecha >= hoy());
    if (yaTieneSala) return error(res, 409, 'Ya tienes una reserva de sala vigente. Completa la reserva anterior antes de solicitar otra.');
    if (sala.capacidad < v.n) return error(res, 400, `${sala.nombre} tiene capacidad para ${sala.capacidad} personas. Elige una sala más grande.`, 'personas');
    if (salaOcupada(sala.id, b.fecha, v.ini, v.fin))
      return error(res, 409, `${sala.nombre} ya fue reservada en ese horario. Elige otra sala o cambia la hora.`);
    const nueva = { id: Date.now(), tipo: 'sala', usuario: correo, salaId: sala.id, sala: sala.nombre, fecha: b.fecha, hora: aHora(v.ini), ini: v.ini, fin: v.fin, personas: v.n };
    reservas.push(nueva); guardar('reservas.json', reservas);
    return res.status(201).json(nueva);
  }

  error(res, 400, 'Tipo de reserva no válido.');
});

app.listen(PORT, () => console.log(`Biblioteca Virtual UTP en http://localhost:${PORT}`));
