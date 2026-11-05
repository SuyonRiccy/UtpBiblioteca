// Login simulado: valida el formulario y guarda el correo en localStorage (no hay servidor de cuentas)
const correo = $('#correo'), clave = $('#clave'), verClave = $('#verClave');
verClave.innerHTML = icono('ojo');

// Mostrar / ocultar contraseña (el estado se anuncia con aria-pressed)
verClave.addEventListener('click', () => {
  const visible = clave.type === 'password';
  clave.type = visible ? 'text' : 'password';
  verClave.setAttribute('aria-pressed', String(visible));
  verClave.setAttribute('aria-label', visible ? 'Ocultar contraseña' : 'Mostrar contraseña');
});

$('#formLogin').addEventListener('submit', (e) => {
  e.preventDefault();
  quitarError(correo); quitarError(clave);
  let primero = null;
  const v = correo.value.trim();
  if (!v) { ponerError(correo, 'Escribe tu correo institucional.'); primero = correo; }
  else if (!/^[^\s@]+@utp\.edu\.pe$/i.test(v)) { ponerError(correo, 'Usa tu correo institucional, que termina en @utp.edu.pe.'); primero = correo; }
  if (clave.value.length < 6) { ponerError(clave, 'Escribe tu contraseña (mínimo 6 caracteres).'); primero = primero || clave; }
  if (primero) { primero.focus(); return; }          // el foco va al primer campo con error
  localStorage.setItem('usuario', v.toLowerCase());
  location.href = 'index.html';
});
if (usuario()) location.href = 'index.html';
