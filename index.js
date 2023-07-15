const express = require('express');
const cors = require('cors');
const axios = require('axios');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const { getDoc, doc, updateDoc } = require('firebase/firestore');
const { getStorage, ref, uploadBytes, getDownloadURL } = require('firebase/storage');
const { db, storage } = require('./firebase'); // make sure to move your firebase.js file to this service

const app = express();

app.use(cors());
app.use(express.json());

// Move your fetchData function here
async function fetchData(userUid, jobDescription, jobId) {
  // ... your existing fetchData function code ...
}

// Move your convertAndStore function here
async function convertAndStore(userUid, jobId) {
  // ... your existing convertAndStore function code ...
}

app.post('/generate-pdf', async (req, res) => {
  try {
    const { userUid, jobId, job } = req.body;
    await fetchData(userUid, job, jobId);
    res.status(200).json({ message: 'Resume generated and stored successfully.', resumeURL: pdfUrl });
  } catch (error) {
    console.error('Error during resume generation:', error);
    res.status(500).json({ message: 'Error during resume generation.' });
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`LaTeX service listening on port ${port}`));