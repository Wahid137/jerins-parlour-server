const express = require('express');
const cors = require('cors');
require('dotenv').config();
const jwt = require('jsonwebtoken');
const port = process.env.PORT || 5000;
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY)
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

const app = express()

//middleware
app.use(cors())
app.use(express.json())


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.gfg0jvx.mongodb.net/?retryWrites=true&w=majority`;
console.log(uri)
// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, { serverApi: { version: ServerApiVersion.v1, strict: true, deprecationErrors: true, } });

async function run() {
    //verify token after getting token from local storage
    function verifyJWT(req, res, next) {
        const authHeader = req.headers.authorization;
        if (!authHeader) {
            return res.status(401).send({ message: 'unauthorized access' })
        }
        const token = authHeader.split(' ')[1]
        jwt.verify(token, process.env.ACCESS_TOKEN, function (err, decoded) {
            if (err) {
                return res.status(403).send({ message: 'forbidden access' })
            }
            req.decoded = decoded;
            next();
        })

    }

    try {
        const parlourServicesCollection = client.db('jerinsParlour').collection('parlourServices');
        const usersCollection = client.db('jerinsParlour').collection('users');
        const paymentsCollection = client.db('jerinsParlour').collection('payments');


        //give token for a user, at first check that the user have in usersCollection
        app.get('/jwt', async (req, res) => {
            const email = req.query.email;
            const query = { email: email }
            const user = await usersCollection.findOne(query);
            if (user) {
                const token = jwt.sign({ email }, process.env.ACCESS_TOKEN, { expiresIn: '1h' })
                return res.send({ accessToken: token })
            }
            res.status(403).send({ accessToken: '' })
        })

        //get parlour services
        app.get('/services', async (req, res) => {
            const query = {}
            const options = await parlourServicesCollection.find(query).toArray()
            res.send(options)
        })

        //get single service
        app.get('/services/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const service = await parlourServicesCollection.findOne(query)
            res.send(service)
        })

        //store users information from sign up page
        app.post('/users', async (req, res) => {
            const user = req.body;
            const result = await usersCollection.insertOne(user);
            res.send(result)
        })
        //create payment intent give client secret
        app.post('/create-payment-intent', async (req, res) => {
            const booking = req.body;
            const price = booking.price;
            const amount = price * 100;

            const paymentIntent = await stripe.paymentIntents.create({
                currency: 'usd',
                amount: amount,
                "payment_method_types": [
                    "card"
                ]
            });
            res.send({
                clientSecret: paymentIntent.client_secret,
            });

        })

        //store payment information and update bookings 
        app.post('/payments', verifyJWT, async (req, res) => {
            const payment = req.body;
            const result = await paymentsCollection.insertOne(payment)
            res.send(result)
        })

        //get parlour booking and payment services
        app.get('/payment', async (req, res) => {
            const query = {}
            const options = await paymentsCollection.find(query).toArray()
            res.send(options)
        })



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