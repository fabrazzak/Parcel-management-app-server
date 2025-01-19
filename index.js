const express = require('express')
const app = express()
const port = process.env.PORT || 5000;
const cors = require('cors')
require('dotenv').config()

app.use(cors())
app.use(express.json())


const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
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
        const bookParcelCollection = client.db("parcel-management").collection("book-parcel");


        // webUser api start 

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
               
                return res.status(500).send({ message: "Internal server error" });
            }
        });



        // API to get all users with pagination and additional functionality
        app.get("/users", async (req, res) => {
            const page = parseInt(req.query.page) || 1; // Default to page 1
            const limit = parseInt(req.query.limit) || 5; // Default to 5 users per page
            const skip = (page - 1) * limit;

            try {
                // Fetch users with pagination
                const users = await userCollection.find().skip(skip).limit(limit).toArray();


                const enhancedUsers = await Promise.all(
                    users.map(async (user) => {
                        const parcelCount = await bookParcelCollection.countDocuments({ userId: user._id, status: { $ne: "canceled" } }); // Exclude canceled parcels
                        const totalSpent = await bookParcelCollection.aggregate([
                            { $match: { userId: user._id, status: { $ne: "canceled" } } },
                            { $group: { _id: null, totalCost: { $sum: "$price" } } },
                        ]).toArray();

                        const phoneNumber = user.phoneNumber || (await bookParcelCollection.findOne({ userId: user._id }).phoneNumber);

                        return {
                            ...user,
                            parcelsBooked: parcelCount || 0,
                            totalSpentAmount: totalSpent[0]?.totalCost || 0,
                            phoneNumber: phoneNumber || "N/A", // Optional: If no phone number is found in the user data
                        };
                    })
                );

                const totalUsers = await userCollection.countDocuments();
                const totalPages = Math.ceil(totalUsers / limit);

                res.status(200).send({ users: enhancedUsers, totalPages, totalUsers });
            } catch (error) {
            
                return res.status(500).send({ message: "Internal server error" });
            }
        });





        app.put("/users", async (req, res) => {
            const { email } = req.body;
            const { role } = req.body;

            try {
                const result = await userCollection.updateOne({ email: email }, { $set: { role } });
                if (result.matchedCount > 0) {
                    res.status(200).send({ message: `Role updated to ${role}` });
                } else {
                    res.status(404).send({ message: "User not found" });
                }
            } catch (error) {
                
                res.status(500).send({ message: "Internal server error" });
            }
        });
        app.put("/users-photourl", async (req, res) => {
            const { email } = req.body;
            const { photoURL } = req.body;

            try {
                const result = await userCollection.updateOne({ email: email }, { $set: { photoURL } });
                if (result.matchedCount > 0) {
                    res.status(200).send({ message: `PhotoURL updated successfully ` });
                } else {
                    res.status(404).send({ message: "User not found" });
                }
            } catch (error) {
               
                res.status(500).send({ message: "Internal server error" });
            }
        });


        app.get("/user/:email", async (req, res) => {

            const query = req.params;


            try {
                const user = await userCollection.findOne(query)

                res.status(200).send(user);
            } catch (error) {
               
                return res.status(500).send({ message: 'Internal server error' });
            }
        });



        // webUser api end 



        // user book parcel api 


        app.post("/book-parcel", async (req, res) => {
            const bookParcel = req.body;
            try {
                const result = await bookParcelCollection.insertOne(bookParcel)
                return res.status(201).send(result)
            }
            catch (error) {
             
                return res.status(5000).send({ message: "Internal server error" })

            }
        })


        app.get("/book-parcels/:email", async (req, res) => {
            const { email } = req.params;
            try {
                const user = await bookParcelCollection.find({ email }).toArray();

                if (user.length === 0) {
                    return res.status(404).send({ message: "User not found" });
                }

                // Send the found user
                res.status(200).send(user);
            } catch (error) {
               
                return res.status(500).send({ message: 'Internal server error' });
            }
        });





        app.put("/book-parcel", async (req, res) => {
            const { id, bookingStatus } = req.body;

            // Validate input
            if (!id || !bookingStatus) {
                return res.status(400).send({ message: "Invalid input. Both id and bookingStatus are required." });
            }

            const query = { _id: new ObjectId(id) };

            try {
                const result = await bookParcelCollection.updateOne(query, { $set: { status: bookingStatus } });

                if (result.matchedCount > 0) {
                    res.status(200).send({ message: "Status update done" });
                } else {
                    res.status(404).send({ message: "Book Parcel not found" });
                }
            } catch (error) {
                
                res.status(500).send({ message: "Internal server error" });
            }
        });



        app.put("/update-book-parcel", async (req, res) => {
            const parcelInfo = req.body; // Data sent in the request body
            const id = parcelInfo._id;


            if (!id) {
                return res.status(400).send({ message: "Invalid input. Parcel ID is required." });
            }

            const { _id, ...updateData } = parcelInfo;

            // Construct the query and update payload
            const query = { _id: new ObjectId(id) };
            const updatePayload = { $set: updateData };

            try {
                const result = await bookParcelCollection.updateOne(query, updatePayload);

                if (result.matchedCount > 0) {
                    res.status(200).send({ message: "Parcel information updated successfully." });
                } else {
                    res.status(404).send({ message: "Parcel not found." });
                }
            } catch (error) {
              
                res.status(500).send({ message: "Internal server error." });
            }
        });



        app.put("/book-parcel-reviews", async (req, res) => {
            const { id, ...deliveryInfo } = req.body;             
        
            if (!id) {
                return res.status(400).send({ message: "Parcel ID is required." });
            }
        
            const query = { _id: new ObjectId(id) }; // Convert `id` to MongoDB ObjectId
            const updatePayload = { $set: deliveryInfo };
        
            try {
                const result = await bookParcelCollection.updateOne(query, updatePayload);
        
                if (result.matchedCount > 0) {
                    res.status(200).send({ message: "Parcel information updated successfully." });
                } else {
                    res.status(404).send({ message: "Parcel not found." });
                }
            } catch (error) {
                console.error("Error updating parcel:", error);
                res.status(500).send({ message: "Internal server error." });
            }
        });
        



        app.get("/all-book-parcels", async (req, res) => {
            const { filter } = req.body;
            try {
                const user = await bookParcelCollection.find().toArray();

                if (user.length === 0) {
                    return res.status(404).send({ message: "User not found" });
                }

                // Send the found user
                res.status(200).send(user);
            } catch (error) {
                
                return res.status(500).send({ message: 'Internal server error' });
            }
        });


        // all delivery man data 

        app.get("/delivery-man", async (req, res) => {
            const page = parseInt(req.query.page) || 1; // Default to page 1
            const limit = parseInt(req.query.limit) || 5; // Default to 5 users per page
            const skip = (page - 1) * limit;
            const query = { role: "delivery-man" }; // Fetch only users with the role "delivery-man"

            try {
                const deliveryMan = await userCollection.find(query).skip(skip).limit(limit).toArray();
                const totalDeliveryMan = await userCollection.countDocuments(query); // Use the query to count delivery men
                const totalPages = Math.ceil(totalDeliveryMan / limit);

                res.status(200).send({ deliveryMan, totalPages, totalDeliveryMan });
            } catch (error) {
                
                return res.status(500).send({ message: "Internal server error" });
            }
        });


        // my delivery list 

        app.get("/my-delivery-list/:id", async (req, res) => {
            const { id } = req.params;
            

            const query = { deliveryManID: id }; // Fetch only users with the role "delivery-man"

            try {
                const result = await bookParcelCollection.find(query).toArray();

                res.status(200).send(result);
            } catch (error) {
                
                return res.status(500).send({ message: "Internal server error" });
            }
        });






        app.put("/assign-book-parcel", async (req, res) => {
            const deliveryInfo = req.body; // Data sent in the request body
            const id = deliveryInfo.parcelId;
            


            if (!id) {
                return res.status(400).send({ message: "Invalid input. Parcel ID is required." });
            }

            const { parcelId, ...updateData } = deliveryInfo;

            // Construct the query and update payload
            const query = { _id: new ObjectId(id) };
            const updatePayload = { $set: updateData };

            try {
                const result = await bookParcelCollection.updateOne(query, updatePayload);

                if (result.matchedCount > 0) {
                    res.status(200).send({ message: "Parcel assign successfully." });
                } else {
                    res.status(404).send({ message: "Parcel not found." });
                }
            } catch (error) {
                
                res.status(500).send({ message: "Internal server error." });
            }
        });




        app.get("/delivery-man-reviews", async (req, res) => {
            const { deliveryManID } = req.query; // Get deliveryManID from the query parameters
        
            if (!deliveryManID) {
                return res.status(400).send({ message: "DeliveryManID is required." });
            }
        
            try {
                // Query to find all parcels associated with the delivery man
                const reviews = await bookParcelCollection
                    .find(
                        { deliveryManID, feedback: { $exists: true }, rating: { $exists: true } }, // Filter for parcels with feedback and rating
                        {
                            projection: {
                                name: 1,
                                email: 1,
                                phoneNumber: 1,
                                feedback: 1,
                                rating: 1,
                                bookingDate: 1,
                                deliveryDate: 1,
                                photoURL:1,
                            },
                        }
                    )
                    .toArray();
                   
                    
                    
        
                if (reviews.length === 0) {
                    return res.status(404).send({ message: "No reviews found for this delivery man." });
                }
        
                // Send the reviews in the response
                res.status(200).send(reviews);
            } catch (error) {
                console.error("Error fetching reviews:", error);
                res.status(500).send({ message: "Internal server error." });
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