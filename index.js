const express = require('express');
const cors = require('cors');
const axios = require('axios');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

const app = express();

app.use(cors());
app.use(express.json());

async function convertAndStore() {
  const texFile = 'temp.tex';
  const tempDir = path.join(process.cwd(), 'temp');

  try {

  await new Promise((resolve, reject) => {
    exec(`pdflatex ${texFile}`, { cwd: tempDir }, (error, stdout, stderr) => {
      if (error) {
        console.error(`Error executing pdflatex: ${error}`);
        reject(error);
      } else {
        // console.log(`PDF generated successfully.`);
        resolve();
      }
    });
  });

} catch (error) {
  console.error('Error during PDF generation or storage:', error);
  throw error;  // Propagate the error back to the caller
}
}

app.post('/generate-pdf', async (req, res) => {
  try {
    await fetchData();
    res.status(200).json({ message: 'Resume generated and stored successfully.'});
  } catch (error) {
    console.error('Error during resume generation:', error);
    res.status(500).json({ message: 'Error during resume generation.' });
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`LaTeX service listening on port ${port}`));