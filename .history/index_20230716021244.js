const express = require('express');
const cors = require('cors');
require('dotenv').config();
const port = process.env.PORT || 5000;
const app = express()
const { MongoClient, ServerApiVersion } = require('mongodb');


//middleware
app.use(cors())
app.use(express.json())


const uri = "mongodb+srv://<username>:<password>@cluster0.gfg0jvx.mongodb.net/?retryWrites=true&w=majority";

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, { serverApi: { version: ServerApiVersion.v1, strict: true, deprecationErrors: true, } });

async function run() {
    try {

    }
    finally {

    }
}
run().catch(console.dir);


app.get('/', async (req, res) => {
    res.send('Jerins parlour running')
})

app.listen(port, () => {
    console.log(`Jerins parlour running on ${port}`)
})