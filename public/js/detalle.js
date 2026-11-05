requerirSesion();
pintarCabecera('catalogo');
const id = Number(new URLSearchParams(location.search).get('id'));
let libro = null, temporizador = null;
for (const b of ['xReserva', 'xFav', 'xCita']) $('#' + b).innerHTML = icono('cerrar');
$('#exitoReserva').innerHTML = icono('check');
$('#iconoLento').innerHTML = icono('alerta');

(async function cargar() {
  try { libro = await api('/api/libros/' + id); }
  catch (e) { $('#ficha').innerHTML = `<h1>Recurso no encontrado</h1><p>${esc(e.message)}</p><a class="btn btn--primario" href="resultados.html">Volver al catálogo</a>`; return; }
  localStorage.setItem('ultimo', libro.id);            // para "Continúa donde lo dejaste"
  document.title = libro.titulo + ' · Biblioteca Virtual UTP';
  $('#ficha').innerHTML = `<div class="ficha">
    <img src="img/${libro.portada}" alt="Portada de ${esc(libro.titulo)}" width="300" height="440">
    <div class="ficha__info">
      <div class="chips" style="margin:0 0 .5rem"><span class="chip">${esc(libro.formato)}</span>${libro.enLinea ? '<span class="chip chip--ok">Disponible en línea</span>' : '<span class="chip">Solo físico</span>'}${libro.fisico ? `<span class="chip">${libro.disponibles} ejemplar${libro.disponibles === 1 ? '' : 'es'} en Sede Chiclayo</span>` : ''}</div>
      <h1>${esc(libro.titulo)}</h1>
      <p class="suave">Autor: ${esc(libro.autores)} &nbsp;•&nbsp; Editorial ${esc(libro.editorial)} &nbsp;•&nbsp; Año ${libro.anio}</p>
      ${libro.enLinea ? `<p class="peso">${icono('descarga')} Vista previa ligera · ${libro.mb} MB (ideal para datos móviles)</p>` : ''}
      <p>${esc(libro.descripcion)}</p>
      <div class="acciones">
        <button class="btn btn--primario" type="button" id="btnLeer" ${libro.enLinea ? '' : 'disabled aria-disabled="true"'}>Leer en línea</button>
        <button class="btn btn--secundario" type="button" id="btnReservar" ${libro.fisico && libro.disponibles > 0 ? '' : 'disabled aria-disabled="true"'}>Reservar ejemplar físico</button>
      </div>
      <div class="acciones">
        <button class="btn btn--secundario" type="button" id="btnFav">Guardar en Favoritos</button>
        <button class="btn btn--secundario" type="button" id="btnCita">Copiar cita APA</button>
      </div>
      ${!libro.enLinea ? '<p class="ayuda">Este recurso no tiene versión digital: puedes reservar el ejemplar físico.</p>' : ''}
      ${libro.fisico && libro.disponibles === 0 ? '<p class="ayuda">No quedan ejemplares físicos disponibles. Prueba leerlo en línea.</p>' : ''}
    </div></div>`;
  $('#btnLeer').addEventListener('click', leerEnLinea);
  $('#btnReservar').addEventListener('click', abrirReserva);
  $('#btnFav').addEventListener('click', abrirFav);
  $('#btnCita').addEventListener('click', abrirCita);
})();

// ---------------- LECTURA EN LÍNEA (carga lenta simulada) ----------------
function leerEnLinea() {
  $('#visor').hidden = false; $('#paginaLectura').hidden = true; $('#avisoLento').hidden = false;
  let p = 0; $('#barra').value = 0;
  $('#textoLento').textContent = `Conexión lenta detectada. Cargando vista previa ligera (${libro.mb} MB) · 0 %`;
  $('#visor').scrollIntoView({ behavior: 'smooth' });
  clearInterval(temporizador);
  temporizador = setInterval(() => {
    p = Math.min(100, p + 8);
    $('#barra').value = p;
    $('#textoLento').textContent = `Conexión lenta detectada. Cargando vista previa ligera (${libro.mb} MB) · ${p} %`;
    if (p === 100) {
      clearInterval(temporizador);
      $('#avisoLento').hidden = true;
      const pag = $('#paginaLectura');
      pag.hidden = false;
      pag.innerHTML = `<h2>Capítulo 1 · ${esc(libro.titulo)}</h2><p>${esc(libro.descripcion)}</p><p class="suave">Vista previa ligera de demostración.</p>`;
      pag.tabIndex = -1; pag.focus();
      aviso('Vista previa lista para leer.', 'exito');
    }
  }, 350);
}
$('#cancelarLectura').addEventListener('click', () => { clearInterval(temporizador); $('#visor').hidden = true; $('#btnLeer').focus(); aviso('Cancelaste la carga.', 'info'); });
$('#verSinConexion').addEventListener('click', irSinConexion);

// ---------------- RESERVA (3 pasos dentro del mismo diálogo) ----------------
const paso = (n) => { for (const i of [1, 2, 3]) $('#reservaPaso' + i).hidden = i !== n; };
const campoErrores = { sede: 'sede', fecha: 'fechaRecojo', franja: 'franja' };
function abrirReserva() {
  paso(1);
  $('#reservaTexto').textContent = libro.titulo;
  const f = $('#fechaRecojo'); f.min = fechaISO(); if (!f.value) f.value = fechaISO(new Date(Date.now() + 86400000));
  for (const c of ['sede', 'fechaRecojo', 'franja']) quitarError($('#' + c));
  $('#reservaErrGeneral').hidden = true;
  $('#dlgReserva').showModal();
}
$('#formReserva').addEventListener('submit', (e) => {
  e.preventDefault();
  quitarError($('#fechaRecojo'));
  if (!$('#fechaRecojo').value) { ponerError($('#fechaRecojo'), 'Elige una fecha de recojo.'); $('#fechaRecojo').focus(); return; }
  $('#reservaResumen').innerHTML = [['Recurso', libro.titulo], ['Sede', $('#sede').value], ['Recojo', fechaLarga($('#fechaRecojo').value)], ['Horario', $('#franja').value]]
    .map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join('');
  paso(2);
});
$('#volverReserva').addEventListener('click', () => paso(1));
$('#confirmarReserva').addEventListener('click', async () => {
  try {
    const r = await api('/api/reservas', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tipo: 'libro', usuario: usuario(), libroId: libro.id, sede: $('#sede').value, fecha: $('#fechaRecojo').value, franja: $('#franja').value }) });
    $('#textoExito').textContent = `Recoge tu ejemplar en la sede ${r.sede} el ${fechaLarga(r.fecha)}, entre las ${r.franja.replace(' – ', ' y las ')}.`;
    paso(3); $('#tituloExito').focus();
  } catch (e) {                                                  // el servidor explica qué pasó y cómo solucionarlo
    paso(1);
    const campo = e.datos && e.datos.campo && campoErrores[e.datos.campo];
    if (campo) { ponerError($('#' + campo), e.message); $('#' + campo).focus(); }
    else { const g = $('#reservaErrGeneral'); g.innerHTML = icono('alerta') + '<span>Error: ' + esc(e.message) + '</span>'; g.hidden = false; }
  }
});

// ---------------- FAVORITOS ----------------
function abrirFav() {
  const f = leerFavs();
  $('#carpeta').innerHTML = f.carpetas.map((c) => `<option>${esc(c)}</option>`).join('');
  $('#dlgFav').showModal();
}
$('#formFav').addEventListener('submit', (e) => {
  e.preventDefault();
  const f = leerFavs(), carpeta = $('#carpeta').value;
  if (!f.items.some((i) => i.id === libro.id && i.carpeta === carpeta)) f.items.push({ id: libro.id, carpeta });
  guardarFavs(f); $('#dlgFav').close();
  aviso(`Guardado en la carpeta «${carpeta}»`, 'exito');
});

// ---------------- CITA APA ----------------
function abrirCita() { $('#textoCita').textContent = citaApa(libro); $('#textoCita').classList.remove('cita--copiada'); $('#dlgCita').showModal(); }
$('#copiarCita').addEventListener('click', async () => {
  try { await navigator.clipboard.writeText($('#textoCita').textContent); }
  catch (e) { const r = document.createRange(); r.selectNodeContents($('#textoCita')); getSelection().removeAllRanges(); getSelection().addRange(r); document.execCommand('copy'); }
  $('#textoCita').classList.add('cita--copiada');
  aviso('Cita en formato APA copiada al portapapeles', 'exito');
});
