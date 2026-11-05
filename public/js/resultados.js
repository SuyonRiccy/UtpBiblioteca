requerirSesion();
pintarCabecera('catalogo');
const params = new URLSearchParams(location.search);
const q = $('#q'), enLinea = $('#enLinea');
q.value = params.get('q') || '';
$('#vacioIcono').innerHTML = icono('alerta');

// Marca en el formulario los filtros que vienen en la URL (ej. ?facultad=Negocios)
for (const nombre of ['formato', 'facultad', 'anio'])
  for (const v of (params.get(nombre) || '').split(',').filter(Boolean))
    $$(`input[name="${nombre}"]`).forEach((i) => { if (i.value === v) i.checked = true; });

// Lee qué casillas están marcadas: ["Libro","Revista"] -> "Libro,Revista"
const marcados = (nombre) => $$(`input[name="${nombre}"]:checked`).map((i) => i.value).join(',');

async function buscar() {
  const p = new URLSearchParams();
  if (q.value.trim()) p.set('q', q.value.trim());
  for (const n of ['formato', 'facultad', 'anio']) if (marcados(n)) p.set(n, marcados(n));
  if (enLinea.checked) p.set('enLinea', 'true');
  history.replaceState(null, '', 'resultados.html' + (p.toString() ? '?' + p : ''));   // la URL refleja los filtros
  const r = await api('/api/libros?' + p);
  const hayResultados = r.total > 0;
  $('#lista').innerHTML = r.libros.map((l) => `<li>${tarjetaRecurso(l)}</li>`).join('');
  $('#vacio').hidden = hayResultados;
  // Mensaje de estado anunciado por el lector de pantalla (aria-live)
  $('#resumen').textContent = hayResultados
    ? `${r.total} resultado${r.total === 1 ? '' : 's'}${q.value.trim() ? ' para «' + q.value.trim() + '»' : ''}`
    : 'No hay resultados';
  if (!hayResultados) {
    $('#vacioTitulo').textContent = q.value.trim() ? `No encontramos resultados para «${q.value.trim()}»` : 'No hay recursos con esos filtros';
    $('#dijiste').hidden = !r.sugerencia;
    if (r.sugerencia) $('#dijisteEnlace').textContent = r.sugerencia;
  }
}
// El interruptor anuncia su estado a lectores de pantalla
enLinea.addEventListener('change', () => enLinea.setAttribute('aria-checked', String(enLinea.checked)));
$('#filtros').addEventListener('change', buscar);
$('#formBuscar').addEventListener('submit', (e) => { e.preventDefault(); buscar(); });
function limpiar() { $$('#filtros input').forEach((i) => { i.checked = false; }); enLinea.setAttribute('aria-checked', 'false'); buscar(); }
$('#limpiar').addEventListener('click', limpiar);
$('#limpiar2').addEventListener('click', limpiar);
$('#dijisteEnlace').addEventListener('click', (e) => { e.preventDefault(); q.value = e.target.textContent; buscar(); });
if (params.get('enLinea') === 'true') { enLinea.checked = true; enLinea.setAttribute('aria-checked', 'true'); }
buscar();
