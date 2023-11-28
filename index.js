const express = require('express')
const app = express()
const cors = require('cors')
const cookieParser = require('cookie-parser')
const jwt = require('jsonwebtoken');
require('dotenv').config();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY)
const port = process.env.PORT || 5000

//middleware
app.use(cors({

    origin:[ 'http://localhost:5173',],
    credentials:true

}
))
app.use(express.json())
app.use(cookieParser())





const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
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
const agreements = client.db("apartmentsDB").collection("agreements");
const announcements = client.db("apartmentsDB").collection("announcements");
const paymentCollection = client.db("apartmentsDB").collection("payment");


async function run() {
  try {


    // HANDMADE MIDDLEWARES

    const verifyToken = (req, res, next)=>{
      if(!req.headers.authorization){
        return res.status(401).send({message: 'FORBIDDEN ACCESS'})
      }
      const token = req.headers.authorization.split(' ')[1]
      jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) =>{
        if(err){
          return res.status(401).send({message: 'ACCESS DENIED'})
        } 
        req.decoded = decoded
        next()
      })
    }



//     const verifyToken = async(req, res, next)=>{
//     const token = req.cookies?.token;
//     if(!token){
//         return res.status(401).send({message: 'not Authorized'})
//     }
//     jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded)=>{
//         if(err){
//             return res.status(401).send({message: 'unauthorized'})
//         }
//         // console.log('value of token is', decoded)
//         req.user = decoded
//         next()
//     })
// }

// const verifyAdmin = async(req, res, next)=>{
//     const email = req.user?.email
//     const query = {email: email}
//     const user = await users.findOne(query)
//     const isAdmin = user?.role === 'admin'
//     if(!isAdmin){
//       return res.status(403).send({message: 'forbidden access'})
//     }
//     next()
//   }

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

  //   JWT TOKENS, COOKIES API

app.post('/jwt', async (req, res) => {
    const user = req.body;
    const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' });
    res.cookie('token', token, {
        httpOnly : false ,
        secure : true,
        sameSite:'none'
    })
    .send({token});
  })

  app.post('/logout', async (req, res) => {
    const user = req.body;
    res
    .clearCookie('token', { maxAge: 0, sameSite: "none", secure: true})
    .send('logged out')
})

// PAYMENT

app.post('/create-payment-intent', async (req, res) => {
  const { price } = req.body;
  const amount = parseInt(price * 100);

  const paymentIntent = await stripe.paymentIntents.create({
    amount: amount,
    currency: 'usd',
    payment_method_types: ['card']
  });

  res.send({
    clientSecret: paymentIntent.client_secret
  })
});

app.get('/payments/:email',verifyToken, async(req, res)=>{
  const query = {email: req.params?.email}
  console.log(req.decoded?.email, 'decoded')
  const emaill = req.params?.email
  if(emaill !== req.decoded.email){
    return res.status(403).send({message: 'Unauthorizedddd'})
  }
  const result = await paymentCollection.find(query).toArray()
  res.send(result)

})

app.post('/payments', async (req, res) => {
  const payment = req.body;
  const paymentResult = await paymentCollection.insertOne(payment);

  res.send({ paymentResult });
})


//   USER API

  app.get('/users',verifyToken,verifyAdmin, async(req, res)=>{
    const result = await users.find().toArray()
    res.send(result)
  })

  app.get('/users/:email', async(req, res)=>{
    const userEmail = req.params?.email
    const query = {email: userEmail}
    const result = await users.findOne(query)
    res.send(result)
  })
  
  app.post(`/users`, async(req, res)=>{
    const user = req.body
    const query = {email : req.body.email} 
    const find = await users.findOne(query)
    if(find){
      return res.send  ({message: 'user already exists', insertedId : null})
    }
    const result = await users.insertOne(user)
    res.send(result)
  })

  app.patch('/users/:email', verifyToken, verifyAdmin, async (req, res) => {

    const updatedUser = req.body;
    const userEmail = req.params.email;
    const filter = { email: userEmail };
    const updateDoc = {
        $set: {
            role: req.body.role,
        }

    };
    const result = await users.updateOne(filter, updateDoc);
    res.send('result');
  })
  app.patch('/user/:email', verifyToken, verifyAdmin, async (req, res) => {

    const updatedUser = req.body;
    const userEmail = req.params.email;
    const filter = { email: userEmail };
    const updateDoc = {
        $set: {
            owned: updatedUser.owned,
        },
    };
    const result = await users.updateOne(filter, updateDoc);
    res.send(result);
  })

  app.patch('/owner/:email', verifyToken, verifyAdmin, async (req, res) => {

    const updatedUser = req.body;
    console.log(updatedUser)
    const userEmail = req.params.email;
    const filter = { email: userEmail };
    const updateDoc = {
        $set:{
          owned: req.body.owned,
          acceptedAgreement:updatedUser.acceptedAgreement._id

        }
    };
    const result = await users.updateOne(filter, updateDoc);
    res.send('lol');
  })


//   APARTMENTS API

app.get('/apartments', async(req, res)=>{
    const query = parseInt(req.query?.page)
    const size = parseInt(req.query?.size)
    const result = await apartments.find().skip(query * size).limit(size).toArray()
    res.send(result)
  })
  app.patch('/apartmentsData', async(req, res)=>{
    const query = {_id : new ObjectId(req.query.id)}
    const updateResult = await apartments.updateOne(query,{ $set: { status: 'notBooked' } } );  
    res.send(updateResult)
  })

  app.get('/apartmentsCount', async (req, res) => {
    const count = await apartments.estimatedDocumentCount();
    res.send( {count });
  })


//   APARTMENT BOOKING API

app.get('/agreements',verifyToken,verifyAdmin, async(req, res)=>{
  let query = {}
  if(req?.query){
    query= {status: req.query?.status}
  }
  const result = await agreements.find(query).toArray()
  res.send(result)
})

app.post('/agreements',verifyToken, async(req, res)=>{
    const agreement = req.body
    const result = await agreements.insertOne(agreement)
    res.send(result)
})

app.patch('/agreements/:_id', verifyToken, verifyAdmin, async (req, res) => {

  const updatedApartment = req.body;
  const id = req.params?._id;
  const filter = { _id: new ObjectId(id) };
  const updateDoc = {
      $set: {
          status: updatedApartment.status,
          acceptedTime: updatedApartment.submissionTime
      },
  };
  const result = await agreements.updateOne(filter, updateDoc);
  res.send(result);
})

app.delete('/agreements/:_id', verifyToken, async(req, res)=>{
  const id = req.params._id
  const query = {_id: new ObjectId(id)}
  const result = await agreements.deleteOne(query);
  res.send(result)
})

app.patch('/apartments/:_id', verifyToken, async (req, res) => {

    const updatedApartment = req.body;
    const id = req.params._id;
    const filter = { _id: new ObjectId(id) };
    const updateDoc = {
        $set: {
            status: updatedApartment.status,
        },
    };
    const result = await apartments.updateOne(filter, updateDoc);
    res.send(result);
})


app.get('/agreements/:id',verifyToken, async(req, res)=>{
  const aggId = req.params?.id
  const query = {_id:  new ObjectId(aggId) }
  const result = await agreements.findOne(query)
  res.send(result)
})

// ANNOUNCEMENT API

app.get('/announcements', async(req, res)=>{
  const result = await announcements.find().toArray()
  res.send(result)
})

app.post('/announcements', async(req, res)=>{
  const announcement = req.body;
  const result = await announcements.insertOne(announcement)
  res.send(result)
})


//   Coupons API

app.get('/coupons', verifyToken, async(req, res)=>{
    const result = await coupons.find().toArray()
    res.send(result)
  })
app.post('/coupons', verifyToken, verifyAdmin, async(req, res)=>{
    const coupon = req.body
    const result = await coupons.insertOne(coupon)
    res.send(result)
  })

  app.patch('/coupons/:_id', verifyToken, verifyAdmin, async (req, res) => {

    const updatedCoupon = req.body;
    console.log(updatedCoupon)
    const id = req.params._id;
    const filter = { _id: new ObjectId(id) };
    const updateDoc = {
        $set: {
            available: updatedCoupon.data,
        },
    };
    const result = await coupons.updateOne(filter, updateDoc);
    res.send(result);
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
