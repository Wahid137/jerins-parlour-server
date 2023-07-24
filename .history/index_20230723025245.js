const express = require('express');
const cors = require('cors');
require('dotenv').config();
const jwt = require('jsonwebtoken');
const nodemailer = require("nodemailer");
const mg = require('nodemailer-mailgun-transport');
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

//send email in mail gun
function sendBookingEmail(payment) {
    const { email, treatName } = payment
    const auth = {
        auth: {
            api_key: process.env.EMAIL_SEND_KEY,
            domain: process.env.EMAIL_SEND_DOMAIN
        }
    }

    const transporter = nodemailer.createTransport(mg(auth));

    // let transporter = nodemailer.createTransport({
    //     host: 'smtp.sendgrid.net',
    //     port: 587,
    //     auth: {
    //         user: "apikey",
    //         pass: process.env.SENDGRID_API_KEY
    //     }
    // })
    transporter.sendMail({
        from: "wahidahmedshanto@gmail.com", // verified sender email
        to: email, // recipient email
        subject: `Your service for ${treatName} is confirmed`, // Subject line
        text: "Hello world!", // plain text body
        html: `
        <h3>Your Booking is Confirmed</h3>
        <div>
            <P>Your service for treatment: ${treatName}</p>
            <p>Please Visit us on timely</p>
            <p>Thanks from Jerins Parlour.</P>
        `, // html body
    }, function (error, info) {
        if (error) {
            console.log(error);
        } else {
            console.log('Email sent: ' + info.response);
        }
    });
}


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
        const reviewsCollection = client.db('jerinsParlour').collection('reviews');
        const servicesCollection = client.db('jerinsParlour').collection('services');


        //make sure you use verifyAdmin after verifyJWT
        const verifyAdmin = async (req, res, next) => {
            const decodedEmail = req.decoded.email;
            const query = { email: decodedEmail }
            const user = await usersCollection.findOne(query);
            if (user?.role !== 'admin') {
                return res.status(403).send({ message: 'Only admin can make admin!' })
            }
            next();
        }

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
            const query = {
                name: payment.treatName,
                email: payment.email
            }
            const alreadyBooked = await paymentsCollection.find(query).toArray()
            if (alreadyBooked.length) {
                const message = `You already have booking on ${payment.name}`
                return res.send({ acknowledged: false, message })
            }
            const result = await paymentsCollection.insertOne(payment)
            //send email about appointment confirmation
            sendBookingEmail(payment)
            res.send(result)
        })

        //add review in database
        app.post('/review', async (req, res) => {
            const review = req.body;
            const result = await reviewsCollection.insertOne(review);
            res.send(result)

        })

        //get parlour booking and payment services
        app.get('/payments', verifyJWT, async (req, res) => {
            const email = req.query.email;
            const decodedEmail = req.decoded.email;
            if (decodedEmail !== email) {
                return res.status(403).send({ message: 'forbidden access' })
            }
            const query = { email: email }
            const options = await paymentsCollection.find(query).toArray()
            res.send(options)
        })

        //from the users list check that the user is admin or not
        app.get('/users/admin/:email', async (req, res) => {
            const email = req.params.email;
            const query = { email: email }
            const user = await usersCollection.findOne(query)
            res.send({ isAdmin: user?.role === 'admin' })
        })

        //store services in database
        app.post('/addservice', verifyJWT, async (req, res) => {
            const service = req.body;
            const result = await servicesCollection.insertOne(service);
            res.send(result)
        })

        //make admin 
        app.put('/users/admin/:email', verifyJWT, verifyAdmin, async (req, res) => {
            const email = req.params.email;
            const filter = { email: email };
            const options = { upsert: true };
            const updatedDoc = {
                $set: {
                    role: "admin"
                }
            }
            const result = await usersCollection.updateOne(filter, updatedDoc, options)
            res.send(result);
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