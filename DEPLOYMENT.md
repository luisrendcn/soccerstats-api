# 🚀 Guía de Deployment en Render

## Requisitos Previos

1. **GitHub**: Repositorio subido
2. **Render Account**: https://render.com (gratis)
3. **Neon Database**: DATABASE_URL configurada

## Pasos de Deployment

### 1. Conectar a Render

1. Login en https://render.com
2. Click en "Create +"
3. Selecciona "Web Service"
4. Conecta tu repositorio de GitHub
5. Selecciona la rama `main` o `master`

### 2. Configurar Build

- **Build Command**: `npm run build`
- **Start Command**: `npm start`
- **Runtime**: Node 22
- **Region**: Oregon (o la más cercana)

### 3. Variables de Entorno

Click en "Environment" y agrega:

```
DATABASE_URL=postgresql://...your-neon-url...
NODE_ENV=production
PORT=10000
```

### 4. Deploy

Click en "Create Web Service" y espera el deployment.

La URL pública será algo como:
```
https://soccer-stats-xxxxx.onrender.com
```

## Verificar Deployment

```bash
curl https://soccer-stats-xxxxx.onrender.com/
```

## Ver Logs

En Render Dashboard → Service → Logs

## Troubleshooting

**Error: DATABASE_URL not found**
- Verifica que DATABASE_URL esté en Environment Variables

**Error: Port already in use**
- Render asigna puerto automáticamente, no hardcodees 5000

**Slow startup**
- Normal en free tier, puede tardar 30-50s
