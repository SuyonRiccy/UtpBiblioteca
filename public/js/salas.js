requerirSesion();
pintarCabecera('salas');

$('#xSala').innerHTML = icono('cerrar');
$('#iconoSala').innerHTML = icono('alerta');
$('#exitoSala').innerHTML = icono('check');

const campos = ['fecha', 'hora', 'duracion', 'personas'].map((c) => $('#' + c));
$('#fecha').min = fechaISO();
$('#fecha').value = fechaISO(new Date(Date.now() + 86400000));

let ultima = null;
let salaElegida = null;
let reservaActiva = null;

// Verifica si el usuario ya cuenta con una sala reservada previamente
async function verificarReservaPrevia() {
  try {
    const lista = await api('/api/reservas');
    // Filtra reservas de tipo sala que sigan vigentes
    reservaActiva = Array.isArray(lista) ? lista.find((r) => r.tipo === 'sala') : null;
  } catch (e) {
    // Si la API no retorna lista directa, revisa respaldo en almacenamiento local
    try {
      const locales = JSON.parse(localStorage.getItem('reservas') || '[]');
      reservaActiva = locales.find((r) => r.tipo === 'sala');
    } catch (_) {
      reservaActiva = null;
    }
  }
  actualizarEstadoBloqueo();
}

function actualizarEstadoBloqueo() {
  const avisoPrevio = $('#avisoYaTieneReserva');
  const btnBuscar = $('#formSala button[type="submit"]');

  if (reservaActiva) {
    // Notificación visible y anunciada para lectores de pantalla
    avisoPrevio.hidden = false;
    avisoPrevio.innerHTML = `<strong>Aviso:</strong> Ya tienes una reserva activa para <em>${esc(reservaActiva.sala || 'Sala de estudio')}</em> el día ${fechaLarga(reservaActiva.fecha)} a las ${reservaActiva.hora}. Solo se permite 1 sala activa por estudiante.`;
    
    // Deshabilita campos de búsqueda para prevenir errores (Nielsen: Prevención de errores)
    campos.forEach((c) => { c.disabled = true; });
    if (btnBuscar) {
      btnBuscar.disabled = true;
      btnBuscar.setAttribute('aria-disabled', 'true');
    }
  } else {
    avisoPrevio.hidden = true;
    avisoPrevio.innerHTML = '';
    campos.forEach((c) => { c.disabled = false; });
    if (btnBuscar) {
      btnBuscar.disabled = false;
      btnBuscar.removeAttribute('aria-disabled');
    }
  }
}

const datos = () => ({
  fecha: $('#fecha').value,
  hora: $('#hora').value,
  duracion: $('#duracion').value,
  personas: $('#personas').value
});

function errorEnCampo(e) {
  const c = e.datos && e.datos.campo && $('#' + e.datos.campo);
  if (c) { ponerError(c, e.message); c.focus(); } else aviso(e.message, 'error');
}

$('#formSala').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (reservaActiva) {
    aviso('Ya cuentas con una sala reservada. Cancela o completa la anterior para pedir otra.', 'alerta');
    return;
  }

  campos.forEach(quitarError);
  const d = datos();
  try {
    const r = await api('/api/salas?' + new URLSearchParams(d));
    ultima = { ...d, horario: r.horario };
    const libres = r.salas.filter((s) => s.disponible).length;
    $('#estadoSalas').textContent = libres 
      ? `${libres} de ${r.salas.length} salas libres el ${fechaLarga(d.fecha)}, de ${r.horario}.` 
      : `No hay salas libres el ${fechaLarga(d.fecha)} de ${r.horario}. Prueba con otra hora o menos personas.`;

    $('#listaSalas').innerHTML = r.salas.map((s) => {
      const estado = s.disponible ? ['Libre', 'chip chip--ok'] : !s.cabe ? ['Capacidad insuficiente', 'chip'] : ['Ocupada en ese horario', 'chip'];
      return `<li class="sala ${s.disponible ? '' : 'sala--ocupada'}">
        <h3>${esc(s.nombre)}</h3>
        <p class="suave pequeno" style="margin:0">Capacidad: ${s.capacidad} personas<br>${esc(s.equipamiento)}</p>
        <p style="margin:0"><span class="${estado[1]}">${estado[0]}</span></p>
        <button type="button" class="btn ${s.disponible ? 'btn--primario' : 'btn--secundario'}" data-sala="${s.id}" ${s.disponible ? '' : 'disabled aria-disabled="true"'} aria-label="Reservar ${esc(s.nombre)}">Reservar sala</button>
      </li>`;
    }).join('');
    ultima.salas = r.salas;
  } catch (err) {
    $('#listaSalas').innerHTML = '';
    $('#estadoSalas').textContent = '';
    errorEnCampo(err);
  }
});

$('#listaSalas').addEventListener('click', (e) => {
  if (reservaActiva) {
    aviso('No puedes reservar más de una sala a la vez.', 'alerta');
    return;
  }
  const b = e.target.closest('button[data-sala]');
  if (!b || b.disabled) return;
  salaElegida = ultima.salas.find((s) => s.id === Number(b.dataset.sala));
  $('#salaResumen').innerHTML = [
    ['Sala', salaElegida.nombre],
    ['Fecha', fechaLarga(ultima.fecha)],
    ['Horario', ultima.horario],
    ['Personas', ultima.personas]
  ].map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join('');

  $('#salaErr').hidden = true;
  $('#salaPaso1').hidden = false;
  $('#salaPaso2').hidden = true;
  $('#dlgSala').showModal();
});

const datosReserva = () => ({
  fecha: ultima.fecha,
  hora: ultima.hora,
  duracion: ultima.duracion,
  personas: ultima.personas
});

$('#confirmarSala').addEventListener('click', async () => {
  try {
    const payload = { tipo: 'sala', salaId: salaElegida.id, sala: salaElegida.nombre, ...datosReserva() };
    const r = await api('/api/reservas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    // Guardamos la referencia de la nueva reserva activa
    reservaActiva = { ...payload, ...(r || {}) };

    $('#textoExitoSala').textContent = `${r.sala || salaElegida.nombre} reservada el ${fechaLarga(r.fecha || payload.fecha)} desde las ${r.hora || payload.hora}, para ${r.personas || payload.personas} personas.`;
    $('#salaPaso1').hidden = true;
    $('#salaPaso2').hidden = false;
    $('#tituloExitoSala').focus();
  } catch (err) {
    const g = $('#salaErr');
    g.innerHTML = icono('alerta') + '<span>Error: ' + esc(err.message) + '</span>';
    g.hidden = false;
  }
});

$('#dlgSala').addEventListener('close', () => {
  if ($('#salaPaso2').hidden === false) {
    actualizarEstadoBloqueo();
    $('#listaSalas').innerHTML = '';
    $('#estadoSalas').textContent = 'Ya tienes una reserva confirmada.';
  }
});

// Validación al cargar la página
verificarReservaPrevia();