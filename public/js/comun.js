// =====================================================================
// comun.js - funciones compartidas por todas las páginas
// =====================================================================
const $ = (sel, raiz = document) => raiz.querySelector(sel);
const $$ = (sel, raiz = document) => [...raiz.querySelectorAll(sel)];

// Evita que texto de la base de datos se interprete como HTML (seguridad)
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
// Quita tildes y pasa a minúsculas (mismo criterio que el servidor)
const norm = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

// ---------- Íconos SVG ----------
// Todos llevan aria-hidden="true": son decorativos porque siempre van junto a un texto
// o dentro de un botón que tiene aria-label (criterio 5: ARIA en íconos sin texto visible)
const ICONOS = {
  lupa: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>',
  check: '<path d="M20 6L9 17l-5-5"/>',
  alerta: '<path d="M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
  info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>',
  descarga: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M7 10l5 5 5-5"/><path d="M12 15V3"/>',
  carpeta: '<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>',
  papelera: '<path d="M3 6h18M8 6V4h8v2m3 0-1 14H6L5 6m4 4v6m6-6v6"/>',
  cerrar: '<path d="M18 6L6 18M6 6l12 12"/>',
  ojo: '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>',
  sinwifi: '<path d="M1 1l22 22"/><path d="M16.7 11.1A11 11 0 0 1 21 13.6"/><path d="M5 12.9a11 11 0 0 1 5.2-2.8"/><path d="M8.5 16.4a6 6 0 0 1 7 0"/><path d="M12 20h.01"/>',
  copiar: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>'
};
const icono = (n) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${ICONOS[n]}</svg>`;

// ---------- Sesión simulada (sin base de datos: se guarda en el navegador) ----------
const usuario = () => localStorage.getItem('usuario');
function requerirSesion() { if (!usuario()) location.href = 'login.html'; }

// ---------- Cabecera de navegación (se repite en todas las páginas) ----------
function pintarCabecera(activo) {
  const items = [['inicio', 'Inicio', 'index.html'], ['catalogo', 'Catálogo', 'resultados.html'], ['salas', 'Salas', 'salas.html'], ['favoritos', 'Favoritos', 'favoritos.html']];
  $('#cabecera').innerHTML = `<div class="cabecera__fila">
    <a href="index.html"><img class="logo-utp" src="img/logo-utp.png" alt="Universidad Tecnológica del Perú, Biblioteca Virtual. Ir al inicio" width="180" height="40"></a>
    <nav aria-label="Principal"><ul>
      ${items.map(([id, txt, url]) => `<li><a class="nav-enlace" href="${url}"${id === activo ? ' aria-current="page"' : ''}>${txt}</a></li>`).join('')}
      <li><button type="button" class="nav-enlace salir" id="btnSalir">Cerrar sesión</button></li>
    </ul></nav></div>`;
  $('#btnSalir').addEventListener('click', () => { localStorage.removeItem('usuario'); location.href = 'login.html'; });
}

// ---------- Avisos flotantes (texto + ícono; el contenedor #avisos tiene aria-live) ----------
function aviso(mensaje, tipo = 'exito') {
  const d = document.createElement('div');
  d.className = 'aviso aviso--' + tipo;
  d.innerHTML = icono(tipo === 'error' ? 'alerta' : tipo === 'info' ? 'info' : 'check') + '<span>' + esc(mensaje) + '</span>';
  $('#avisos').appendChild(d);
  setTimeout(() => d.remove(), 5000);
}

// ---------- Errores de formulario: texto explicativo + ícono, no solo color ----------
// Cada input tiene un <p id="{id}Err" role="alert"> asociado con aria-describedby
function ponerError(input, mensaje) {
  const err = $('#' + input.id + 'Err');
  input.setAttribute('aria-invalid', 'true');
  err.innerHTML = icono('alerta') + '<span>Error: ' + esc(mensaje) + '</span>';
  err.hidden = false;
}
function quitarError(input) {
  input.removeAttribute('aria-invalid');
  const err = $('#' + input.id + 'Err');
  err.hidden = true; err.textContent = '';
}

// ---------- Llamadas a la API ----------
// Si falla la red (TypeError) mandamos al usuario a la pantalla "Sin conexión"
function irSinConexion() { location.href = 'sin-conexion.html?volver=' + encodeURIComponent(location.pathname + location.search); }
async function api(url, opciones) {
  let r;
  try { r = await fetch(url, opciones); } catch (e) { irSinConexion(); throw e; }
  const datos = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(datos.error || 'Ocurrió un error. Inténtalo de nuevo.'), { datos, estado: r.status });
  return datos;
}
window.addEventListener('offline', () => aviso('Se perdió tu conexión a internet. Revisa tu Wi-Fi o tus datos móviles.', 'error'));
if (!navigator.onLine && !location.pathname.endsWith('sin-conexion.html')) irSinConexion();

// ---------- Fechas ----------
const fechaISO = (d = new Date()) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const fechaLarga = (iso) => iso.split('-').reverse().join('/');   // 2026-11-10 -> 10/11/2026

// ---------- Favoritos (localStorage: sin base de datos) ----------
function leerFavs() {
  try { const f = JSON.parse(localStorage.getItem('favoritos')); if (f && f.carpetas) return f; } catch (e) { /* si está dañado, empezamos de cero */ }
  return { carpetas: ['General', 'Administración', 'Enfermería'], items: [] };
}
const guardarFavs = (f) => localStorage.setItem('favoritos', JSON.stringify(f));

// ---------- Cita APA 7.ª ----------
function autorApa(a) {
  if (/revista|colegio|editorial/i.test(a)) return a;                 // autor institucional
  const partes = a.replace(/^(Dra?\.)\s+/, '').trim().split(/\s+/);
  const apellido = partes.pop();
  return apellido + ', ' + partes.map((p) => p[0].toUpperCase() + '.').join(' ');
}
function citaApa(l) {
  const a = l.autores.split(',').map((s) => autorApa(s.trim()));
  const autores = a.length > 1 ? a.slice(0, -1).join(', ') + ', & ' + a[a.length - 1] : a[0];
  return `${autores} (${l.anio}). ${l.titulo}. ${l.editorial}.`;
}

// ---------- Tarjeta de recurso (componente reutilizado en inicio, resultados y favoritos) ----------
function tarjetaRecurso(l, conPapelera = false) {
  return `<article class="recurso">
    <img src="img/${l.portada}" alt="Portada de ${esc(l.titulo)}" width="92" height="128">
    <div class="recurso__texto">
      <h3>${esc(l.titulo)}</h3>
      <p class="suave pequeno">${esc(l.autores)} | ${esc(l.editorial)}, ${l.anio}</p>
      <div class="chips"><span class="chip">${esc(l.formato)}</span>${l.enLinea ? '<span class="chip chip--ok">Disponible en línea</span>' : ''}${l.fisico ? '<span class="chip">Sede Chiclayo</span>' : ''}</div>
    </div>
    <div class="recurso__acciones">
      ${conPapelera ? `<button type="button" class="btn--eliminar" data-quitar-fav="${l.id}" aria-label="Quitar ${esc(l.titulo)} de favoritos" title="Quitar de favoritos">${icono('papelera')}</button>` : ''}
      <a class="btn btn--secundario" href="detalle.html?id=${l.id}" aria-label="Ver detalle de ${esc(l.titulo)}">Ver detalle</a>
    </div>
  </article>`;
}

// ---------- Diálogos: el botón con data-cerrar cierra el <dialog> más cercano ----------
document.addEventListener('click', (e) => { const b = e.target.closest('[data-cerrar]'); if (b) b.closest('dialog').close(); });
