requerirSesion();
pintarCabecera('favoritos');
$('#xCarpeta').innerHTML = icono('cerrar');
let carpetaActiva = 'Todas', todos = [];

function pintar() {
  const f = leerFavs();
  const cuenta = (c) => c === 'Todas' ? f.items.length : f.items.filter((i) => i.carpeta === c).length;
  // aria-pressed anuncia cuál carpeta está seleccionada
  $('#carpetas').innerHTML = ['Todas', ...f.carpetas].map((c) => `<li><button type="button" data-carpeta="${esc(c)}" aria-pressed="${c === carpetaActiva}">${icono('carpeta')}<span>${esc(c)}</span><span class="n">${cuenta(c)}</span></button></li>`).join('');
  const ids = f.items.filter((i) => carpetaActiva === 'Todas' || i.carpeta === carpetaActiva).map((i) => i.id);
  const libros = todos.filter((l) => ids.includes(l.id));
  $('#tituloCarpeta').textContent = `Carpeta: ${carpetaActiva} · ${libros.length} recurso${libros.length === 1 ? '' : 's'}`;
  $('#listaFav').innerHTML = libros.map((l) => `<li>${tarjetaRecurso(l)}</li>`).join('');
  $('#vacioFav').hidden = libros.length > 0;
}
$('#carpetas').addEventListener('click', (e) => { const b = e.target.closest('button[data-carpeta]'); if (b) { carpetaActiva = b.dataset.carpeta; pintar(); b.focus(); } });
$('#carpetas').addEventListener('click', () => { const b = $('#carpetas button[aria-pressed="true"]'); if (b) b.focus(); });

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
