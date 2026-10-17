# Welcome to Antigravity!

Welcome to your new developer home! Your Firebase Studio project has been successfully migrated to Antigravity.

Antigravity is our next-generation, agent-first IDE designed for high-velocity, autonomous development. Because Antigravity runs locally on your machine, you now have access to powerful local workflows and fully integrated AI editing capabilities that go beyond a cloud-based web IDE.

## Getting Started
- **Run Locally**: Use the **Run and Debug** menu on the left sidebar to start your local development server.
  - Or in a terminal run `npm run dev` and visit `http://localhost:9002`.
- **Deploy**: You can deploy your changes to Firebase App Hosting by using the integrated terminal and standard Firebase CLI commands, just as you did in Firebase Studio.
- **Firestore rules**: Deploying App Hosting does not publish Firestore Security Rules. After signing in with Firebase CLI, publish the rules separately with `firebase deploy --only firestore:rules --project studio-4236454254-aba86`.
- **Cleanup**: Cleanup unused artifacts with the @cleanup workflow.

## Operación de nómina y contabilidad

- Marcar una cita como **En sitio** registra la visita base de $20.000 en el expediente para su liquidación.
- Desarrollo puede devolver una nómina de técnico desde el historial a validación de costos. La liquidación original permanece en el historial; la nueva revisión no suma el registro devuelto al Balance.
- Gerencia y Desarrollo publican noticias desde **Noticias emergentes**. Se muestran al iniciar sesión hasta su vencimiento o eliminación; cerrar la ventana no elimina la noticia.
- Los gastos operativos se registran desde **Contabilidad > Gastos de la empresa**. El Balance suma los expedientes validados o pagados que tengan número de factura y presenta las cuentas de cobro de nómina como soporte, sin duplicar el egreso.
- Los documentos PDF de nómina y cuenta de cobro usan márgenes de 2 cm. La cuenta de cobro incluye el total de servicios y la firma/cédula del técnico.
- Las colecciones `announcements` y `company_expenses` requieren publicar las reglas actualizadas con el comando de Firestore indicado arriba.

Enjoy the next era of AI-driven development!

File any bugs at https://github.com/firebase/firebase-tools/issues

**Firebase Studio Export Date:** 2026-03-20


---

## Previous README.md contents:

# Firebase Studio

This is a NextJS starter in Firebase Studio.

To get started, take a look at src/app/page.tsx.
