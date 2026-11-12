# Mis Hábitos

Aplicación web instalable (PWA) para iPhone que ayuda a crear hábitos: ejercicio, tomar agua, leer, estudiar, avanzar con el trabajo o los que quieras agregar.

## Qué hace

- **Hoy**: lista de hábitos del día. Marca cada uno como realizado o usa el cronómetro para registrar tiempo. En los hábitos de cantidad (por ejemplo vasos de agua) la barra muestra cada unidad y se marca tocándola.
- **Objetivo de 66 días**: cada hábito lleva su racha de días seguidos cumplidos. Al llegar a 66 el hábito se da por logrado, con medallas intermedias a los 3, 7, 14, 21, 30 y 45 días.
- **Alarmas**: cada hábito puede tener varias horas de aviso. Con la app abierta suena y muestra un aviso con opciones para iniciar, marcar o posponer 10 minutos.
- **Resumen**: por día, 7 días o 30 días. Muestra lo que falta hoy con botones para marcarlo, el cumplimiento comparado con el período anterior, un gráfico o calendario donde se toca un día para ver su detalle, y por hábito el avance hacia los 66 días y si se alcanzó el tiempo mínimo.
- **Hábitos**: crea y edita hábitos con ícono, color, tipo de medición (tiempo mínimo, cantidad o solo marcar), días de la semana y alarmas.
- **Ajustes**: notificaciones, sonido, envío de alarmas al Calendario y copia en la nube.

## Copia en iCloud o Google Drive

En **Ajustes › Copia en la nube**, «Guardar» abre el menú de compartir del iPhone: elige **Guardar en Archivos** y luego iCloud Drive o Google Drive. «Restaurar» abre Archivos para elegir la copia. La copia es manual; la app recuerda hacerla cada semana.

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
