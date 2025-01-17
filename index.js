const express = require('express')
const app = express()
const port = process.env.PORT || 5000;
const cors = require('cors')
require('dotenv').config()

app.use(cors())
app.use(express.json())


const { MongoClient, ServerApiVersion } = require('mongodb');
const uri = `${process.env.DB_URI}`

const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});



app.get('/', (req, res) => {
    res.send('Hello World!')
})

async function run() {
    try {
        const userCollection = client.db("parcel-management").collection("users");

        app.post("/users", async (req, res) => {
            const newUser = req.body;

            try {

                const existingUser = await userCollection.findOne({ email: newUser.email });
                if (existingUser) {
                    return res.status(400).send({ message: "Email already exists" });
                }

                const result = await userCollection.insertOne(newUser);
                return res.status(201).send(result);
            } catch (error) {
                console.error("Error inserting user:", error);
                return res.status(500).send({ message: "Internal server error" });
            }
        });



        app.get("/users", async (req, res) => {

            const page = parseInt(req.query.page) || 1;  // Default to page 1
            const limit = parseInt(req.query.limit) || 5;  // Default to 5 users per page
            const skip = (page - 1) * limit;
            try {
                const users = await userCollection.find().skip(skip).limit(limit).toArray();              
                const totalUsers = await userCollection.countDocuments();
                const totalPages = Math.ceil(totalUsers / limit);
                res.status(200).send({ users, totalPages,totalUsers });
            } catch (error) {
                console.error('Error fetching users:', error);
                return res.status(500).send({ message: 'Internal server error' });
            }
        });

        app.put("/users", async (req, res) => {
            const {email} = req.body;
            const { role } = req.body;  
            console.log(email,role)
          
            try {
              const result = await userCollection.updateOne({ email: email },{ $set: { role } });          
              if (result.matchedCount > 0) {
                res.status(200).send({ message: `Role updated to ${role}` });
              } else {
                res.status(404).send({ message: "User not found" });
              }
            } catch (error) {
              console.error("Error updating user role:", error);
              res.status(500).send({ message: "Internal server error" });
            }
          });

          
        app.get("/user/:email", async (req, res) => {

            const query =req.params;  
                    
            try {
                const user = await userCollection.findOne(query)
                
                res.status(200).send(user);
            } catch (error) {
                console.error('Error fetching users:', error);
                return res.status(500).send({ message: 'Internal server error' });
            }
        });


          


  




        console.log("Pinged your deployment. You successfully connected to MongoDB!");

    } finally {

        // await client.close();
    }
}
run().catch(console.dir);


app.listen(port, () => {
    console.log(`Example app listening on port ${port}`)
})