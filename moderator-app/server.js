const express = require('express');
const path = require('path');

const moderatorApiRouter = require('./routes/moderatorApi');

const app = express();
const PORT = process.env.MODERATOR_CONTAINER_INTERNAL ||3100;

app.use('/', moderatorApiRouter);

app.use(express.static(path.join(__dirname, 'public'))); //serve static files from public directory

app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server is running on port ${PORT}`);
});

