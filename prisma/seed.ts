import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';

const prisma = new PrismaClient();

export async function seedDemoChat() {
  // Create demo users
  const user1 = await prisma.user.create({
    data: {
      id: uuidv4(),
      display_name: 'Alex',
    },
  });

  const user2 = await prisma.user.create({
    data: {
      id: uuidv4(),
      display_name: 'Jordan',
    },
  });

  // Create demo chat
  const chat = await prisma.chat.create({
    data: {
      id: uuidv4(),
      origin: 'demo',
      mediator_style: 'nvc',
      turn_taking: 'sequential',
      participants: {
        create: [
          { user_id: user1.id, role: 'user' },
          { user_id: user2.id, role: 'user' },
        ],
      },
    },
  });

  // Create initial messages
  const messages = [
    {
      type: 'message',
      data: {
        content: 'Hey Jordan, I wanted to talk about our project deadline.',
        senderId: user1.id,
      },
    },
    {
      type: 'message',
      data: {
        content: 'Sure Alex, what\'s on your mind?',
        senderId: user2.id,
      },
    },
    {
      type: 'message',
      data: {
        content: 'I\'m feeling a bit overwhelmed with the current timeline. Do you think we could extend it by a week?',
        senderId: user1.id,
      },
    },
    {
      type: 'message',
      data: {
        content: 'I notice that Alex is expressing concern about the project timeline and requesting an extension. Jordan, how do you feel about this request?',
        senderId: 'assistant',
      },
    },
  ];

  // Create events for each message
  for (const message of messages) {
    await prisma.event.create({
      data: {
        id: uuidv4(),
        chat_id: chat.id,
        type: message.type,
        data: message.data,
      },
    });
  }

  return { chat, user1, user2 };
}

// Only run if this file is executed directly
if (require.main === module) {
  seedDemoChat()
    .then(() => {
      console.log('Demo chat seeded successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Error seeding demo chat:', error);
      process.exit(1);
    });
}