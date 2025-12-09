const { sequelize, User, Account, Message } = require('./database');
const bcrypt = require('bcryptjs');

async function seed() {
    try {
        // 1. Sync Database (Updates schema)
        await sequelize.sync({ alter: true });
        console.log("✅ Database Synced");

        // 2. Create Admin User
        const hashedPassword = await bcrypt.hash('admin123', 10);
        const [admin, created] = await User.findOrCreate({
            where: { username: 'admin' },
            defaults: { 
                password: hashedPassword, 
                role: 'admin' 
            }
        });

        if (created) {
            console.log("✅ Admin User Created: username='admin', password='admin123'");
        } else {
            console.log("ℹ️ Admin User already exists.");
        }

        // 3. Create a Dummy Account (To test the UI)
        const [account] = await Account.findOrCreate({
            where: { identifier: 'UC_DEMO_123' },
            defaults: {
                platform: 'youtube',
                name: 'Raptee Demo Channel',
                accessToken: 'mock_token',
                isActive: true
            }
        });

        // 4. Create Dummy Posts & Messages (For the new Master-Detail View)
        const posts = [
            { id: 'vid_1', title: 'Raptee High Voltage Launch', img: 'https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg' },
            { id: 'vid_2', title: 'Customer Delivery Day 1', img: 'https://via.placeholder.com/640x360.png?text=Delivery+Day' }
        ];

        for (const post of posts) {
            await Message.create({
                platform: 'youtube',
                accountId: account.id,
                externalId: `msg_${Date.now()}_${post.id}`,
                
                // POPULATING NEW FIELDS
                postId: post.id,
                postTitle: post.title,
                mediaUrl: post.img,

                authorName: 'DemoUser',
                content: 'Is this available in Delhi properly?',
                intent: 'Inquiry',
                aiDraft: 'Yes, we are launching in Delhi next month.',
                status: 'pending'
            });
        }
        console.log("✅ Dummy Data Added for Testing!");

    } catch (e) {
        console.error("❌ Seeding Failed:", e);
    } finally {
        process.exit();
    }
}

seed();