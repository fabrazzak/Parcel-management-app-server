const express = require('express')
const app = express()
const port = process.env.PORT || 5000;
const cors = require('cors')
const jwt = require('jsonwebtoken');


require('dotenv').config()

app.use(cors())
app.use(express.json())
const Stripe = require('stripe');
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

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

    res.send('Parcel Management app')
})

async function run() {
    try {
        const userCollection = client.db("parcel-management").collection("users");
        const blogsCollection = client.db("parcel-management").collection("blogs");
        const bookParcelCollection = client.db("parcel-management").collection("book-parcel");
        const dhriServicers = client.db("parcel-management").collection("services");


        // Middleware for verifying JWT
        const verifyUser = (req, res, next) => {

            const token = req.headers.authorization?.split(' ')[1]; // Get the token from "Authorization" header

            if (!token) {
                return res.status(401).send({ message: 'Unauthorized: No token provided' });
            }


            jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
                if (err) {
                    return res.status(403).send({ message: 'Invalid or expired token' });
                }

                req.user = decoded.email; // Attach user info to the request object               
                next();
            });
        };



        // JWT Token Route
        app.post('/jwt', (req, res) => {
            const { email } = req.body;


            if (!email) {
                return res.status(400).send({ message: 'Email is required' });
            }

            const token = jwt.sign({ email }, process.env.JWT_SECRET, { expiresIn: '1h' });
            res.status(200).send({ token, message: 'Login successful and login' });
        });

        // Logout Route
        app.post('/logout', (req, res) => {
            res.status(200).send({ message: 'Logged out successfully' });
        });










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


        app.get("/blogs", async (req, res) => {
            const page = parseInt(req.query.page) || 1; // Default to page 1
            const limit = parseInt(req.query.limit) || 6; // Default to 5 blogs per page
            const skip = (page - 1) * limit;

            try {
                // Fetch blogs with pagination
                const blogs = await blogsCollection.find().skip(skip).limit(limit).toArray();

                // Enhance blog data (if necessary)
                const enhancedBlogs = blogs.map((blog) => {
                    // Here you can perform any additional logic to enhance the blog data
                    // For example, you can add tags, comments count, or other metadata
                    return {
                        ...blog,
                        // Example: Add a random 'readTime' for demonstration
                        readTime: Math.floor(Math.random() * 10) + 3, // Random read time between 3-12 minutes
                    };
                });

                const totalBlogs = await blogsCollection.countDocuments();
                const totalPages = Math.ceil(totalBlogs / limit);

                res.status(200).send({
                    blogs: enhancedBlogs,
                    totalPages,
                    totalBlogs,
                });
            } catch (error) {
                console.error("Error fetching blogs:", error);
                return res.status(500).send({ message: "Internal server error" });
            }
        });



        app.get('/api/services', async (req, res) => {
            try {
                const services = await dhriServicers.find();
                res.json(services);
            } catch (error) {
                res.status(500).json({ message: "Server Error", error });
            }
        });


        app.get('/api/services/:id', async (req, res) => {
            const { id } = req.params;
        
            try {
                const service = await dhriServicers.findById(id);
        
                if (!service) {
                    return res.status(404).json({ message: "Service not found" });
                }
        
                res.json(service);
            } catch (error) {
                res.status(500).json({ message: "Server Error", error });
            }
        });



        // Assuming you have already set up MongoDB connection and `blogsCollection` is defined

        app.get("/blogs/:blogId", async (req, res) => {
            const { blogId } = req.params; // Retrieve blogId from the URL parameter

            try {
                // Fetch a single blog by its ID
                const blog = await blogsCollection.findOne({ id: parseInt(blogId) });

                if (!blog) {
                    return res.status(404).send({ message: "Blog not found!" });
                }

                // Enhance blog data (optional)
                const enhancedBlog = {
                    ...blog,
                    // Example: Add a random 'readTime' for demonstration
                    readTime: Math.floor(Math.random() * 10) + 3, // Random read time between 3-12 minutes
                };

                res.status(200).send(enhancedBlog);
            } catch (error) {
                console.error("Error fetching blog:", error);
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

                // Enhance user data
                const enhancedUsers = await Promise.all(
                    users.map(async (user) => {
                        // Fetch the phone number from bookParcelCollection based on userId
                        const bookParcel = await bookParcelCollection.findOne({
                            userId: user._id.toString(),
                        });

                        const phoneNumber = bookParcel?.phoneNumber || "N/A"; // Default to "N/A" if no phone number is found

                        // Count parcels excluding "canceled" and "pending" statuses
                        const parcelCount = await bookParcelCollection.countDocuments({
                            userId: user._id.toString(),
                            status: { $nin: ["canceled", "pending"] },
                        });

                        // Calculate total spent amount
                        const totalSpent = await bookParcelCollection
                            .aggregate([
                                {
                                    $match: {
                                        userId: user._id.toString(),
                                        status: { $nin: ["canceled", "pending"] },
                                    },
                                },
                                {
                                    $group: { _id: null, totalCost: { $sum: "$price" } },
                                },
                            ])
                            .toArray();
                        console.log

                        return {
                            ...user,
                            phoneNumber,
                            parcelsBooked: parcelCount || 0,
                            totalSpentAmount: totalSpent[0]?.totalCost || 0,
                        };
                    })
                );

                const totalUsers = await userCollection.countDocuments();
                const totalPages = Math.ceil(totalUsers / limit);

                res.status(200).send({ users: enhancedUsers, totalPages, totalUsers });
            } catch (error) {
                console.error("Error fetching users:", error);
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


        app.get("/user/:email", verifyUser, async (req, res) => {
            const query = req.params;


            if (req.user !== query.email) {
                return res.status(500).send({ message: 'UnAuthorization error' })
            }
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


        app.get("/book-parcels/:email", verifyUser, async (req, res) => {
            const { email } = req.params;
            if (req.user !== email) {
                return res.status(500).send({ message: 'UnAuthorization error' })
            }
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
            console.log(updateData)

            // Construct the query and update payload
            const query = { _id: new ObjectId(id) };
            const updatePayload = { $set: updateData };

            try {
                const result = await bookParcelCollection.updateOne(query, updatePayload);

                if (result.matchedCount > 0) {
                    res.status(200).send({ message: "Parcel information updated successfully.", success: true });
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
                // Fetch paginated delivery men
                const deliveryMan = await userCollection.find(query).skip(skip).limit(limit).toArray();
                const countReviewsWithoutZeroRating = await bookParcelCollection.countDocuments({ rating: { $ne: 0 } });




                // Enhance delivery men with additional details
                const enhancedDeliveryMan = await Promise.all(
                    deliveryMan?.map(async (user) => {
                        const parcelDelivered = await bookParcelCollection.countDocuments({
                            deliveryManID: user._id.toString(),
                            status: { $nin: ["canceled", "pending"] }, // Exclude "canceled" and "pending"
                        });

                        // Aggregate total ratings
                        const totalReviews = await bookParcelCollection
                            .aggregate([
                                {
                                    $match: {
                                        deliveryManID: user._id.toString(),
                                        status: { $nin: ["canceled", "pending"] },
                                    },
                                },
                                {
                                    $group: {
                                        _id: null,
                                        totalRating: { $sum: { $ifNull: ["$rating", 0] } }, // Ensure null safety for ratings

                                    },
                                },
                            ])
                            .toArray();
                        console.log(totalReviews)
                        // Calculate average rating and ensure no division by zero
                        const averageRating = parcelDelivered > 0 ? (totalReviews[0]?.totalRating || 0) / countReviewsWithoutZeroRating : 0;

                        // Retrieve phone number
                        const phoneNumber =
                            user.phoneNumber ||
                            (await userCollection.findOne({ _id: user._id }, { projection: { phoneNumber: 1 } }))
                                ?.phoneNumber ||
                            "N/A";

                        return {
                            ...user,
                            parcelDelivered: parcelDelivered || 0,
                            reviewAverage: averageRating,
                            phoneNumber,
                        };
                    })
                );

                // Count total delivery men
                const totalDeliveryMan = await userCollection.countDocuments(query);
                const totalPages = Math.ceil(totalDeliveryMan / limit);

                // Send the response
                res.status(200).send({ deliveryMan: enhancedDeliveryMan, totalPages, totalDeliveryMan });
            } catch (error) {
                console.error("Error fetching delivery man data:", error);
                res.status(500).send({ message: "Internal server error" });
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

            // Validate the deliveryManID format
            if (!deliveryManID || !ObjectId.isValid(deliveryManID)) {
                return res.status(400).send({ message: "Valid DeliveryManID is required." });
            }

            try {
                // Query to find all parcels associated with the delivery man
                const reviews = await bookParcelCollection.find(
                    {
                        deliveryManID,
                        feedback: { $exists: true },
                        rating: { $exists: true }
                    },
                    {
                        projection: {
                            name: 1,
                            email: 1,
                            phoneNumber: 1,
                            feedback: 1,
                            rating: 1,
                            bookingDate: 1,
                            deliveryDate: 1,
                            photoURL: 1,
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


        app.get("/chart-data", async (req, res) => {
            try {
                // Total parcels by status
                const parcelsByStatus = await bookParcelCollection.aggregate([
                    {
                        $group: {
                            _id: "$status", // Group by status
                            count: { $sum: 1 }, // Count total parcels per status
                        },
                    },
                ]).toArray();

                // Monthly data for parcels booked
                const monthlyParcels = await bookParcelCollection.aggregate([
                    {
                        $group: {
                            _id: {
                                year: { $year: { $toDate: "$deliveryDate" } }, // Extract year
                                month: { $month: { $toDate: "$deliveryDate" } }, // Extract month
                            },
                            totalParcels: { $sum: 1 }, // Total parcels booked per month
                        },
                    },
                    { $sort: { "_id.year": 1, "_id.month": 1 } }, // Sort by year and month
                ]).toArray();

                // Prepare response data
                const chartData = {
                    parcelsByStatus: parcelsByStatus.map(item => ({
                        status: item._id,
                        count: item.count,
                    })),
                    monthlyParcels: monthlyParcels.map(item => ({
                        month: `${item._id.year}-${String(item._id.month).padStart(2, "0")}`, // Format as "YYYY-MM"
                        totalParcels: item.totalParcels,
                    })),
                };

                res.status(200).send(chartData);
            } catch (error) {
                console.error("Error fetching chart data:", error);
                res.status(500).send({ message: "Internal server error" });
            }
        });


        app.post('/create-payment-intent', async (req, res) => {
            try {
                const { amount, currency } = req.body;

                if (!amount || !currency) {
                    return res.status(400).json({ error: 'Amount and currency are required.' });
                }

                const paymentIntent = await stripe.paymentIntents.create({
                    amount,
                    currency,
                    payment_method_types: ['card'],
                });

                res.status(200).json({ clientSecret: paymentIntent.client_secret });
            } catch (error) {
                console.error('Error creating payment intent:', error);
                res.status(500).json({ error: 'Internal Server Error' });
            }
        });



        app.get('/top-delivery-men', async (req, res) => {
            try {
                // Aggregate delivery data from bookParcelCollection
                const topDeliveryMen = await bookParcelCollection.aggregate([
                    {
                        $match: { status: 'delivered' }, // Filter only delivered parcels
                    },
                    {
                        $group: {
                            _id: '$deliveryManID', // Group by deliveryManID
                            totalParcels: { $sum: 1 }, // Count the number of delivered parcels
                            averageRating: { $avg: '$rating' }, // Calculate average rating
                        },
                    },
                    {
                        $sort: {
                            totalParcels: -1, // Sort by total parcels delivered (descending)
                            averageRating: -1, // Then by average rating (descending)
                        },
                    },
                    {
                        $limit: 3, // Limit to top 3 delivery men
                    },
                ]).toArray();

                // Fetch detailed user information from userCollection for each deliveryManID
                const detailedDeliveryMen = await Promise.all(
                    topDeliveryMen.map(async (deliveryMan) => {
                        const user = await userCollection.findOne({ _id: new ObjectId(deliveryMan._id) });

                        return {
                            deliveryManID: deliveryMan._id,
                            name: user?.displayName || 'Unknown',
                            email: user?.email || 'Unknown',
                            photoURL: user?.photoURL || '',
                            role: user?.role || 'Unknown',
                            totalParcels: deliveryMan.totalParcels,
                            averageRating: deliveryMan.averageRating.toFixed(2), // Format average rating
                        };
                    })
                );
                console.log(topDeliveryMen)
                res.status(200).json(detailedDeliveryMen);
            } catch (error) {
                console.error('Error fetching top delivery men:', error);
                res.status(500).json({ error: 'Failed to fetch top delivery men' });
            }
        });










        // console.log("Pinged your deployment. You successfully connected to MongoDB!");

    } finally {

        // await client.close();
    }
}
run().catch(console.dir);


app.listen(port, () => {
    console.log(`Example app listening on port ${port}`)
})