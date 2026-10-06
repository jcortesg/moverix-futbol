-- Páginas legales editables (fuente única para app y web).
CREATE TABLE IF NOT EXISTS legal_pages (
  key varchar(40) PRIMARY KEY,
  title varchar(120) NOT NULL,
  content text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO legal_pages (key, title, content) VALUES
('privacy', 'Política de Privacidad',
$$Tu privacidad es importante para nosotros. Esta política explica cómo recopilamos, usamos y protegemos tu información.

1. INFORMACIÓN QUE RECOPILAMOS
- Datos de registro: nombre, email, fecha de nacimiento
- Datos deportivos: posición, equipo, estadísticas
- Datos de identificación e información sensible: número de documento (cédula), documentos de identidad y fotografías que se cargan para validar tu inscripción a los torneos
- Datos de uso: interacciones dentro de la app

2. USO DE LA INFORMACIÓN
Usamos tu información únicamente para: mantener tu perfil de jugador, gestionar tu inscripción y participación en los torneos, validar tu identidad ante los organizadores del campeonato, mostrar estadísticas y clasificaciones, mejorar la experiencia de usuario y enviar notificaciones relevantes.

El uso de tu información se realiza únicamente para temas operativos del campeonato (inscripciones, validación de identidad, conformación de plantillas y estadísticas). La aplicación Moverix NO hace uso de esta información para fines propios, NO la comercializa ni la comparte con terceros bajo ninguna circunstancia. Actuamos solo como intermediarios técnicos entre el jugador y el organizador del torneo.

3. PROTECCIÓN DE DATOS SENSIBLES
Tus documentos de identidad, número de documento y demás información sensible se almacenan de forma segura en servidores protegidos, con cifrado en reposo y transmitidos mediante conexiones cifradas (HTTPS). El acceso a estos datos está restringido: solo el organizador del torneo en el que participas y el personal autorizado de Moverix pueden consultarlos, y únicamente para verificar tu inscripción. Esta información NO es pública ni visible para otros jugadores.

4. COMPARTIR INFORMACIÓN
Tu perfil público (nombre, equipo, estadísticas) es visible para otros usuarios. Tu información sensible (documento, fotos de identidad) NO se comparte con otros jugadores ni se vende a terceros bajo ninguna circunstancia.

5. SEGURIDAD
Implementamos medidas de seguridad para proteger tus datos: cifrado en reposo de la información almacenada, transporte mediante conexiones cifradas (HTTPS), acceso restringido a personal autorizado y autenticación mediante Firebase Authentication.

6. TUS DERECHOS
Puedes solicitar la consulta, corrección o eliminación de tu cuenta y de tus datos en cualquier momento desde la configuración de la app (Perfil > Eliminar cuenta) o escribiendo a soporte@moverix.com. La eliminación de la cuenta borra tu información personal y sensible de nuestros sistemas.

Última actualización: Agosto 2026$$),

('terms', 'Términos y Condiciones',
$$Bienvenido a Moverix. Al usar esta aplicación, aceptas los siguientes términos:

1. USO DE LA PLATAFORMA
Moverix es una plataforma para la gestión de torneos de fútbol amateur. El uso de la app está destinado a jugadores, directores técnicos y organizadores de torneos.

2. CUENTAS DE USUARIO
Eres responsable de mantener la seguridad de tu cuenta. No compartas tus credenciales de acceso con terceros.

3. CONTENIDO
Todo contenido que publiques (fotos, comentarios, etc.) debe respetar las normas de la comunidad. Nos reservamos el derecho de eliminar contenido inapropiado.

4. ESTADÍSTICAS Y DATOS
Las estadísticas de partidos son registradas por los organizadores de cada torneo. Moverix no garantiza la precisión absoluta de estos datos.

5. MODIFICACIONES
Nos reservamos el derecho de modificar estos términos en cualquier momento. Los cambios serán notificados a través de la aplicación.

Última actualización: Agosto 2026$$)
ON CONFLICT (key) DO NOTHING;
