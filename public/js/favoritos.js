requerirSesion();
pintarCabecera('favoritos');
$('#xCarpeta').innerHTML = icono('cerrar');
$('#xEliminarFav').innerHTML = icono('cerrar');
let carpetaActiva = 'Todas', todos = [];
let libroParaEliminar = null;

function pintar() {
  const f = leerFavs();
  const cuenta = (c) => c === 'Todas' ? f.items.length : f.items.filter((i) => i.carpeta === c).length;
  // aria-pressed anuncia cuál carpeta está seleccionada
  $('#carpetas').innerHTML = ['Todas', ...f.carpetas].map((c) => `<li><button type="button" data-carpeta="${esc(c)}" aria-pressed="${c === carpetaActiva}">${icono('carpeta')}<span>${esc(c)}</span><span class="n">${cuenta(c)}</span></button></li>`).join('');
  const ids = f.items.filter((i) => carpetaActiva === 'Todas' || i.carpeta === carpetaActiva).map((i) => i.id);
  const libros = todos.filter((l) => ids.includes(l.id));
  $('#tituloCarpeta').textContent = `Carpeta: ${carpetaActiva} · ${libros.length} recurso${libros.length === 1 ? '' : 's'}`;
  $('#listaFav').innerHTML = libros.map((l) => `<li>${tarjetaRecurso(l, true)}</li>`).join('');
  $('#vacioFav').hidden = libros.length > 0;
}
$('#carpetas').addEventListener('click', (e) => { const b = e.target.closest('button[data-carpeta]'); if (b) { carpetaActiva = b.dataset.carpeta; pintar(); b.focus(); } });
$('#carpetas').addEventListener('click', () => { const b = $('#carpetas button[aria-pressed="true"]'); if (b) b.focus(); });

$('#listaFav').addEventListener('click', (e) => {
  const boton = e.target.closest('button[data-quitar-fav]');
  if (!boton) return;
  libroParaEliminar = Number(boton.dataset.quitarFav);
  const libro = todos.find((l) => l.id === libroParaEliminar);
  $('#dlgEliminarFavTitulo').textContent = '¿Quitar de favoritos?';
  $('#textoConfirmarEliminar').textContent = carpetaActiva === 'Todas'
    ? `«${libro?.titulo || 'Este recurso'}» se quitará de todas tus carpetas de favoritos.`
    : `«${libro?.titulo || 'Este recurso'}» se quitará de la carpeta «${carpetaActiva}».`;
  $('#dlgEliminarFav').showModal();
  $('#btnConfirmarQuitar').focus();
});

$('#btnConfirmarQuitar').addEventListener('click', () => {
  if (libroParaEliminar === null) return;
  const f = leerFavs();
  f.items = f.items.filter((i) => i.id !== libroParaEliminar || (carpetaActiva !== 'Todas' && i.carpeta !== carpetaActiva));
  guardarFavs(f);
  $('#dlgEliminarFav').close();
  libroParaEliminar = null;
  pintar();
  $('#tituloCarpeta').focus();
  aviso('Recurso quitado de favoritos.', 'exito');
});

$('#nuevaCarpeta').addEventListener('click', () => { $('#nombreCarpeta').value = ''; quitarError($('#nombreCarpeta')); $('#dlgCarpeta').showModal(); $('#nombreCarpeta').focus(); });
$('#formCarpeta').addEventListener('submit', (e) => {
  e.preventDefault();
  const n = $('#nombreCarpeta'), nombre = n.value.trim(), f = leerFavs();
  quitarError(n);
  if (!nombre) { ponerError(n, 'Escribe un nombre para la carpeta.'); n.focus(); return; }
  if (f.carpetas.some((c) => norm(c) === norm(nombre))) { ponerError(n, 'Ya tienes una carpeta con ese nombre. Escribe otro.'); n.focus(); return; }
  f.carpetas.push(nombre); guardarFavs(f); carpetaActiva = nombre; $('#dlgCarpeta').close(); pintar();
  aviso(`Carpeta «${nombre}» creada`, 'exito');
});
api('/api/libros').then((r) => { todos = r.libros; pintar(); });
