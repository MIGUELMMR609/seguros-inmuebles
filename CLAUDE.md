# SEGUROS-INMUEBLES — Contexto del Proyecto

## Descripción
Aplicación de gestión de pólizas de seguros inmobiliarios.
Arquitectura separada: backend Node.js/Express + frontend estático + PostgreSQL.

## Stack
- Backend: Node.js/Express (backend/server.js)
- Frontend: frontend/ (estático, deploy separado en Render)
- Base de datos: PostgreSQL 18 (seguros-inmuebles-db en Render, Oregon)
- Deploy backend: seguros-inmuebles-backend en Render (Frankfurt)
- Deploy frontend: seguros-inmuebles-web en Render (Global, estático)
- GitHub: MIGUELMMR609/seguros-inmuebles
- Local: ~/Dropbox/CLAUDE/seguros-inmuebles/

## Reglas obligatorias antes de cada push
1. Ejecutar siempre node --check backend/server.js
2. Verificar que los {} están balanceados
3. Cambios quirúrgicos únicame
