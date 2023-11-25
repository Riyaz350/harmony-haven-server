const express = require('express')
const app = express()
const cors = require('cors')
const cookieParser = require('cookie-parser')
const jwt = require('jsonwebtoken');
require('dotenv').config();
// const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY)
const port = process.env.PORT || 5000

//middleware
app.use(cors({

    origin:[ 'http://localhost:5173',],
    credentials:true

}
))
app.use(express.json())
app.use(cookieParser())





const { MongoClient, ServerApiVersion } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.gx7mkcg.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

const apartments = client.db("apartmentsDB").collection("apartments");
const users = client.db("apartmentsDB").collection("users");
const coupons = client.db("apartmentsDB").collection("coupons");


async function run() {
  try {


    // HANDMADE MIDDLEWARES

    const verifyToken = async(req, res, next)=>{
    const token = req.cookies?.token;
    if(!token){
        return res.status(401).send({message: 'not Authorized'})
    }
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded)=>{
        if(err){
            console.log(err)
            return res.status(401).send({message: 'unauthorized'})
        }
        // console.log('value of token is', decoded)
        req.user = decoded
        next()
    })
}

const verifyAdmin = async(req, res, next)=>{
    const email = req.decoded.email
    const query = {email: email}
    const user = await users.findOne(query)
    const isAdmin = user?.role === 'admin'
    if(!isAdmin){
      return res.status(403).send({message: 'forbidden access'})
    }
    next()
  }


//   USER API

  app.get('/users', async(req, res)=>{
    const result = await users.find().toArray()
    res.send(result)
  })
  
  app.post(`/users`, async(req, res)=>{
    const user = req.body
    console.log(user)
    const query = {email : req.body.email} 
    const find = await users.findOne(query)
    if(find){
      return res.send  ({message: 'user already exists', insertedId : null})
    }
    const result = await users.insertOne(user)
    res.send(result)
  })

//   APARTMENTS API

app.get('/apartments', async(req, res)=>{
    const result = await apartments.find().toArray()
    res.send(result)
  })


//   Coupons API

app.get('/coupons', async(req, res)=>{
    const result = await coupons.find().toArray()
    res.send(result)
  })


//   JWT TOKENS, COOKIES API

app.post('/jwt', async (req, res) => {
    const user = req.body;
    const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' });
    res
    .cookie('token', token, {httpOnly : false , secure : true, sameSite:'none'})
    .send({ token });
  })

  app.post('/logout', async (req, res) => {
    const user = req.body;
    console.log('logging out', user);
    res
    .clearCookie('token', { maxAge: 0, sameSite: "none", secure: true})
    .send('logged out')
})



    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {

  }
}
run().catch(console.dir);

app.listen(port, ()=>{
    console.log(`Landlord is sitting on port ${port} `)
})
