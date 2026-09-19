# Metah

App web para acompanhar o cumprimento de metas diárias, com sistema de streak (sequência de dias).

## Estrutura
- `backend/` — API em Node.js + Express + SQLite (better-sqlite3)
- `frontend/` — HTML/CSS/JS puro, consumindo a API

## Como rodar

### Back-end
```
cd backend
npm install
cp .env.example .env   # edite o JWT_SECRET
npm run dev             # ou: npm start
```
A API sobe em `http://localhost:3000`.

### Front-end
Basta abrir `frontend/index.html` no navegador (ou servir com Live Server).
Certifique-se que a API está rodando, pois o front consome `http://localhost:3000/api`.

## Funcionalidades
- Cadastro/login de usuário (JWT)
- Criar, editar e excluir metas
- Marcar/desmarcar conclusão do dia
- Cálculo automático de streak (dias seguidos cumprindo a meta)

## Próximos passos sugeridos
- Calendário visual do histórico (endpoint `/metas/:id/historico` já retorna os dados)
- Gráfico de evolução com Chart.js
- Notificação/lembrete de metas pendentes no fim do dia
