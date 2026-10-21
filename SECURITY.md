# Límites de seguridad

Este proyecto es un sitio estático. No tiene un servidor confiable, proveedor de identidad ni registro oficial del examen.

- La pantalla completa, detección de foco, bloqueos de teclado, faltas y cronómetro se ejecutan en el navegador del estudiante. Se pueden eludir o modificar; sirven como señales disuasorias y de conveniencia.
- La pantalla de incidentes y sus datos no están autenticados. Un resumen calculado en el navegador no demuestra quién lo creó ni si fue alterado.
- El PIN descifra el enlace en el navegador. Se puede compartir junto con el enlace y la URL descifrada queda disponible para esa página.
- Google Forms procesa las respuestas según su propia configuración. Este sitio no verifica la identidad ni impide abrir el formulario en otro dispositivo.
- La recuperación guarda en `sessionStorage` el payload cifrado y el estado del incidente y del cronómetro. Vuelve a pedir identidad y PIN; al cargar, limpia snapshots antiguos que guardaban identidad y URL en claro.
- El cronómetro calcula una fecha límite con el reloj local para compensar pestañas suspendidas. El usuario puede alterar el reloj o el estado de la página, así que no es un plazo verificable.

Usa el proyecto solo para supervisión de bajo riesgo. Para verificar identidad, plazos y reportes se necesita un backend que autentique a los estudiantes, valide los plazos y cree registros de auditoría en el servidor. Ningún cambio solo en el navegador puede ofrecer esas garantías.
