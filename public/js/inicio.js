requerirSesion();
pintarCabecera('inicio');
$('.lupa-envoltura').outerHTML = icono('lupa').replace('<svg', '<svg class="lupa"');

const q = $('#q'), lista = $('#listaSug');
let sugerencias = [], activo = -1, espera;

const irA = (texto) => { location.href = 'resultados.html?q=' + encodeURIComponent(texto); };
function cerrarLista() { lista.hidden = true; q.setAttribute('aria-expanded', 'false'); q.removeAttribute('aria-activedescendant'); activo = -1; }

// Resalta en negrita lo que el usuario ya escribió
function resaltar(texto) {
  const i = norm(texto).indexOf(norm(q.value));
  if (i < 0) return esc(texto);
  const n = q.value.trim().length;
  return esc(texto.slice(0, i)) + '<strong>' + esc(texto.slice(i, i + n)) + '</strong>' + esc(texto.slice(i + n));
}
function pintarLista() {
  lista.innerHTML = sugerencias.map((t, i) => `<li role="option" id="opt-${i}" aria-selected="${i === activo}"><span>${resaltar(t)}</span>${i === 0 ? '<span class="tip">Enter para abrir</span>' : ''}</li>`).join('');
  lista.hidden = !sugerencias.length;
  q.setAttribute('aria-expanded', String(sugerencias.length > 0));
  if (activo >= 0) q.setAttribute('aria-activedescendant', 'opt-' + activo); else q.removeAttribute('aria-activedescendant');
}

// Pide sugerencias al servidor 200 ms después de dejar de escribir
q.addEventListener('input', () => {
  clearTimeout(espera);
  if (q.value.trim().length < 2) { sugerencias = []; cerrarLista(); return; }
  espera = setTimeout(async () => {
    try { sugerencias = await api('/api/sugerencias?q=' + encodeURIComponent(q.value)); activo = -1; pintarLista(); } catch (e) { cerrarLista(); }
  }, 200);
});

// Teclado: flechas para moverse, Enter para abrir, Esc para cerrar
q.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowDown' && sugerencias.length) { e.preventDefault(); activo = (activo + 1) % sugerencias.length; pintarLista(); }
  else if (e.key === 'ArrowUp' && sugerencias.length) { e.preventDefault(); activo = (activo - 1 + sugerencias.length) % sugerencias.length; pintarLista(); }
  else if (e.key === 'Escape') cerrarLista();
  else if (e.key === 'Enter' && sugerencias.length && !lista.hidden) {
    e.preventDefault();                                   // mejora del PA1: Enter abre la sugerencia (la primera si no elegiste otra)
    irA(sugerencias[activo >= 0 ? activo : 0]);
  }
});
lista.addEventListener('click', (e) => { const li = e.target.closest('li'); if (li) irA(sugerencias[Number(li.id.replace('opt-', ''))]); });
document.addEventListener('click', (e) => { if (!e.target.closest('.buscador__caja')) cerrarLista(); });
$('#formBuscar').addEventListener('submit', (e) => { e.preventDefault(); irA(q.value.trim()); });

// "Continúa donde lo dejaste": último recurso visto (por defecto el 1)
api('/api/libros/' + (localStorage.getItem('ultimo') || 1)).then((l) => { $('#ultimo').innerHTML = tarjetaRecurso(l); }).catch(() => {});
