# Mis Hábitos

Aplicación web instalable (PWA) para iPhone que ayuda a crear hábitos: ejercicio, tomar agua, leer, estudiar, avanzar con el trabajo o los que quieras agregar.

## Qué hace

- **Hoy**: lista de hábitos del día. Marca cada uno como realizado, suma cantidades (por ejemplo vasos de agua) o usa el cronómetro para registrar tiempo.
- **Alarmas**: cada hábito puede tener varias horas de aviso. Con la app abierta suena y muestra un aviso con opciones para iniciar, marcar o posponer 10 minutos.
- **Resumen**: por día, 7 días o 30 días. Indica cuántas metas se cumplieron y, por hábito, si se alcanzó el tiempo mínimo establecido, cuánto faltó y la racha actual.
- **Hábitos**: crea y edita hábitos con ícono, color, tipo de medición (tiempo mínimo, cantidad o solo marcar), días de la semana y alarmas.
- **Ajustes**: notificaciones, sonido, envío de alarmas al Calendario, copia de seguridad y restauración.

Los datos se guardan únicamente en el dispositivo.

## Alarmas con la app cerrada

iOS no permite que una app web programe alarmas mientras está cerrada. Para recibirlas siempre, usa **Ajustes › Enviar alarmas al Calendario**: genera un archivo que agrega los hábitos como eventos repetidos con alerta en el Calendario del iPhone. Si cambias horarios, vuelve a enviarlo.

## Publicar e instalar

1. En GitHub: **Settings › Pages › Deploy from a branch**, elige la rama y la carpeta `/ (root)`.
2. Abre la dirección publicada en **Safari** en el iPhone.
3. Toca **Compartir › Agregar a pantalla de inicio**.

## Probar en la computadora

```bash
python3 -m http.server 8000
```

Luego abre `http://localhost:8000`.

No requiere compilación ni dependencias: `index.html`, `styles.css`, `app.js`, `sw.js` y `manifest.webmanifest`.
