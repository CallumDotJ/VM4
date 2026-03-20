const express = require('express');
const router = express.Router();
//const jokes = require('../tempData/jokes.json');
const mysql = require('mysql2');
const path = require('path')


// DB connection setup - using env vars



router.get('/moderate', async (req, res) => {

    res.setHeader('Content-Type', 'application/JSON');

    res.json({"avaliable": true, "joke": {
        "setup" : "test setup",
        "punchline" : "test punchline",
    }})
   
})




    
module.exports = router;