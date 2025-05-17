require('dotenv').config();
const express = require('express');
const multer = require('multer');
const AWS = require('aws-sdk');
const path = require('path');

const app = express();
const port = 3000;

// Configure AWS with LocalStack endpoint
const awsConfig = {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || 'test',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || 'test',
    endpoint: process.env.AWS_ENDPOINT || 'http://192.168.0.108:4566',
    s3ForcePathStyle: true,
    region: process.env.AWS_REGION || 'us-east-1'
};

console.log(process.env.LOCALSTACK_AUTH_TOKEN);

// Initialize AWS services
const s3 = new AWS.S3(awsConfig);
const lambda = new AWS.Lambda(awsConfig);
const sqs = new AWS.SQS(awsConfig);
const sns = new AWS.SNS(awsConfig);

// Middleware
app.use(express.json());
app.use(express.static('public'));

// S3 Routes
app.get('/api/s3/buckets', async (req, res) => {
    try {
        const data = await s3.listBuckets().promise();
        res.json(data.Buckets);
    } catch (err) {
        console.error('Error listing buckets:', err);
        res.status(500).json({ error: 'Error listing buckets' });
    }
});

app.post('/api/s3/buckets', async (req, res) => {
    try {
        const { bucketName } = req.body;
        await s3.createBucket({ Bucket: bucketName }).promise();
        res.json({ message: 'Bucket created successfully' });
    } catch (err) {
        console.error('Error creating bucket:', err);
        res.status(500).json({ error: 'Error creating bucket' });
    }
});

app.delete('/api/s3/buckets/:bucketName', async (req, res) => {
    try {
        await s3.deleteBucket({ Bucket: req.params.bucketName }).promise();
        res.json({ message: 'Bucket deleted successfully' });
    } catch (err) {
        console.error('Error deleting bucket:', err);
        res.status(500).json({ error: 'Error deleting bucket' });
    }
});

// Lambda Routes
app.get('/api/lambda/functions', async (req, res) => {
    try {
        const data = await lambda.listFunctions().promise();
        res.json(data.Functions);
    } catch (err) {
        console.error('Error listing Lambda functions:', err);
        res.status(500).json({ error: 'Error listing Lambda functions' });
    }
});

// SQS Routes
app.get('/api/sqs/queues', async (req, res) => {
    try {
        const data = await sqs.listQueues().promise();
        res.json(data.QueueUrls || []);
    } catch (err) {
        console.error('Error listing queues:', err);
        res.status(500).json({ error: 'Error listing queues' });
    }
});

app.post('/api/sqs/queues', async (req, res) => {
    try {
        const { queueName } = req.body;
        const data = await sqs.createQueue({ QueueName: queueName }).promise();
        res.json({ message: 'Queue created successfully', queueUrl: data.QueueUrl });
    } catch (err) {
        console.error('Error creating queue:', err);
        res.status(500).json({ error: 'Error creating queue' });
    }
});

// SNS Routes
app.get('/api/sns/topics', async (req, res) => {
    try {
        const data = await sns.listTopics().promise();
        res.json(data.Topics || []);
    } catch (err) {
        console.error('Error listing topics:', err);
        res.status(500).json({ error: 'Error listing topics' });
    }
});

app.post('/api/sns/topics', async (req, res) => {
    try {
        const { topicName } = req.body;
        const data = await sns.createTopic({ Name: topicName }).promise();
        res.json({ message: 'Topic created successfully', topicArn: data.TopicArn });
    } catch (err) {
        console.error('Error creating topic:', err);
        res.status(500).json({ error: 'Error creating topic' });
    }
});

// Existing S3 file management routes
const storage = multer.memoryStorage();
const upload = multer({
    storage: storage,
    limits: {
        fileSize: 5 * 1024 * 1024
    }
});

app.get('/api/s3/:bucket/files', async (req, res) => {
    try {
        const data = await s3.listObjects({ Bucket: req.params.bucket }).promise();
        const files = data.Contents || [];
        const normalizedFiles = files.map(file => ({
            ...file,
            DisplayName: Buffer.from(file.Key, 'latin1').toString('utf8'),
            EncodedKey: encodeURIComponent(file.Key)
        }));
        res.json(normalizedFiles);
    } catch (err) {
        console.error('Error listing files:', err);
        res.status(500).json({ error: 'Error listing files' });
    }
});

app.post('/api/s3/:bucket/upload', upload.single('file'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }

    try {
        const params = {
            Bucket: req.params.bucket,
            Key: req.file.originalname,
            Body: req.file.buffer,
            ContentType: req.file.mimetype
        };

        await s3.upload(params).promise();
        res.json({ message: 'File uploaded successfully' });
    } catch (err) {
        console.error('Error uploading file:', err);
        res.status(500).json({ error: 'Error uploading file' });
    }
});

app.delete('/api/s3/:bucket/files/:filename', async (req, res) => {
    try {
        const params = {
            Bucket: req.params.bucket,
            Key: decodeURIComponent(req.params.filename)
        };

        await s3.deleteObject(params).promise();
        res.json({ message: 'File deleted successfully' });
    } catch (err) {
        console.error('Error deleting file:', err);
        res.status(500).json({ error: 'Error deleting file' });
    }
});

// Start server
app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
}); 