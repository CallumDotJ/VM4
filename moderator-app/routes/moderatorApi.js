const express = require("express");
const router = express.Router();
const amqp = require("amqplib");
const { readCache, writeCache } = require("../utils/cacheHelpers");

// RMQ connection setup - using env vars
const RMQ_USER_NAME = process.env.RABBITMQ_DEFAULT_USER || "admin";
const RMQ_PASSWORD = process.env.RABBITMQ_DEFAULT_PASS || "admin";
const RMQ_HOST = process.env.RABBITMQ_HOST || "rabbitmq";
const RMQ_PORT = process.env.RABBITMQ_PORT || 5672;

const SUBMIT_QUEUE = process.env.SUBMIT_QUEUE || "submit_queue";
const MODERATED_QUEUE = process.env.MODERATED_QUEUE || "moderated_queue";

const TYPE_CONSUME_QUEUE =
  process.env.TYPE_CONSUME_QUEUE || "moderate_type_consume_queue";
const EXCHANGE = process.env.TYPE_UPDATE_EXCHANGE || "type_update_exchange";

const CONSTR =
  process.env.AMQP_URL ||
  `amqp://${RMQ_USER_NAME}:${RMQ_PASSWORD}@${RMQ_HOST}:${RMQ_PORT}/`;

const TYPES_CACHE_PATH =
  process.env.TYPE_CACHE_PATH || "../cache/typeCache.json";

let gConnection;
let gChannel;

createQueueConnection();

/**
 * GET /types
 * Returns cached joke types from file cache
 */
router.get("/types", async (req, res) => {
  try {
    const cached = await readCache(TYPES_CACHE_PATH);

    if (cached && cached.length > 0) {
      return res.json({ types: cached, source: "cache" });
    }

    return res
      .status(503)
      .json({ error: "types unavailable (no cache available)" });
  } catch (err) {
    console.error("GET /types error:", err.message);
    return res.status(500).json({ error: "failed to read types cache" });
  }
});

/*
 /moderate
  Gets one joke from the submit queue if available
 */
router.get("/moderate", async (req, res) => {
  try {
    if (!gChannel) {
      return res.status(503).json({ error: "queue channel not available" });
    }

    await gChannel.assertQueue(SUBMIT_QUEUE, { durable: true });

    // pull one message only 
    const msg = await gChannel.get(SUBMIT_QUEUE, { noAck: false }); // no ack yet

    if (!msg) {
      return res.json({
        available: false,
        message: "no jokes currently available for moderation",
      });
    }

    const joke = JSON.parse(msg.content.toString());

    // acknowledge only after successful parse
    gChannel.ack(msg);

    return res.json({
      available: true,
      joke,
    });
  } catch (err) {
    console.error(" /moderate error:", err.message);
    return res.status(500).json({ error: "failed to retrieve joke from queue" });
  }
});

/**
 * /moderated
 * accepts moderated joke from UI and sends it to moderated queue
 */
router.post("/moderated", async (req, res) => {
  try {
    const setup = req.body.setup?.trim();
    const punchline = req.body.punchline?.trim();
    const type = req.body.type?.trim().toLowerCase();

    if (!setup || !punchline || !type) {
      return res
        .status(400)
        .json({ error: "please provide setup, punchline and type" });
    }

    if (setup.length < 3 || punchline.length < 3 || type.length < 3) {
      return res.status(400).json({
        error: "setup, punchline and type must be at least 3 characters",
      });
    }

    const msg = { setup, punchline, type };

    await sendMsg(gChannel, MODERATED_QUEUE, msg);

    return res.json({ message: "moderated joke submitted successfully" });
  } catch (err) {
    console.error("POST /moderated error:", err.message);
    return res
      .status(500)
      .json({ error: "error processing moderated joke - queue error" });
  }
});

/* --- RABBITMQ Functions --- */

async function createQueueConnection() {
  for (let i = 0; i < 5 && !gConnection; i++) {
    await new Promise((resolve) => setTimeout(resolve, 2000));

    try {
      console.log(`Trying to connect to RabbitMQ at ${RMQ_HOST}:${RMQ_PORT}`);

      const rmq = await createConnection(CONSTR);
      gConnection = rmq.connection;
      gChannel = rmq.channel;

      gConnection.on("error", (err) => {
        console.log(`Connection error: ${err}`);
      });

      gConnection.on("close", () => {
        console.log("Connection closed");
      });
    } catch (err) {
      console.log(`Failed to connect to RabbitMQ: ${err.message}`);
    }
  }
}

async function createConnection(conStr) {
  try {
    const connection = await amqp.connect(conStr);
    console.log(`Connected to rabbitmq using ${conStr}`);

    const channel = await connection.createChannel();
    console.log("Channel created");

    // queues used by moderate service
    await channel.assertQueue(SUBMIT_QUEUE, { durable: true });
    await channel.assertQueue(MODERATED_QUEUE, { durable: true });

    // subscribe to type update exchange for cache refresh
    await channel.assertExchange(EXCHANGE, "fanout", { durable: true });

    // bind queue to listen to exchange
    const q = await channel.assertQueue(TYPE_CONSUME_QUEUE, { durable: true });
    await channel.bindQueue(q.queue, EXCHANGE, "");
    await channel.prefetch(1);

    await channel.consume(q.queue, async (msg) => {
      if (!msg) return;

      try {
        const obj = JSON.parse(msg.content.toString());
        const types = obj?.types;

        if (!Array.isArray(types)) {
          console.log("invalid type_update payload - types is not an array");
          channel.ack(msg);
          return;
        }

        await writeCache(TYPES_CACHE_PATH, types);
        console.log(`MODERATE says: cache refreshed with ${types.length} types`);

        channel.ack(msg);
      } catch (err) {
        console.log(`Failed to process type_update event: ${err.message}`);
        channel.nack(msg, false, true);
      }
    });

    return { connection, channel };
  } catch (err) {
    console.log("Failed to connect to queue in createConnection function");
    throw err;
  }
}

async function sendMsg(channel, queueName, msg) {
  try {
    await channel.assertQueue(queueName, { durable: true });

    channel.sendToQueue(queueName, Buffer.from(JSON.stringify(msg)), {
      persistent: true,
    });

    console.log(`Sent to ${queueName}:`, msg);
  } catch (err) {
    console.log(`Failed to write to ${queueName} queue. ${err}`);
    throw err;
  }
}

module.exports = router;