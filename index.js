const express = require('express');
const cors = require('cors');
const axios = require('axios');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

const app = express();

app.use(cors());
app.use(express.json());

async function convertAndStore(latexString) {
  const tempDir = path.join(process.cwd(), 'temp');
  const tempTexFile = path.join(tempDir, 'temp.tex');
  const tempPdfFile = path.join(tempDir, 'temp.pdf');
  fs.writeFileSync(tempTexFile, latexString);

  try {
  console.log('this is latex string: ', latexString)
  await new Promise((resolve, reject) => {
    exec(`pdflatex ${tempTexFile}`, { cwd: path.dirname(tempTexFile) }, (error, stdout, stderr) => {
      if (error) {
        console.error(`Error executing pdflatex: ${error}`);
        reject(error);
      } else {
        // console.log(`PDF generated successfully.`);
        resolve();
      }
    });
  });

  const pdfBuffer = fs.readFileSync(tempPdfFile);

  // Delete intermediate files
  const filesToDelete = [
    path.join(tempDir, 'temp.aux'),
    path.join(tempDir, 'temp.log'),
    path.join(tempDir, 'temp.out'),
    tempPdfFile,
    tempTexFile,
  ];
  filesToDelete.forEach((file) => {
    if (fs.existsSync(file)) {
      fs.unlink(file, (err) => {
        if (err) {
          console.error(`Error deleting ${file}: ${err}`);
        } else {
          console.log(`Deleted ${file}`);
        }
      });
    } else {
      console.log(`File ${file} does not exist`);
    }
  });

  return pdfBuffer;

} catch (error) {
  console.error('Error during PDF generation or storage:', error);
  throw error;  // Propagate the error back to the caller
}
}

app.post('/generate-pdf', async (req, res) => {
  try {
    const { latexString } = req.body;
    const pdfBuffer = await convertAndStore(latexString);
    res.contentType("application/pdf");
    res.status(200)
    res.send(pdfBuffer);
  } catch (error) {
    console.error('Error during resume generation:', error);
    res.status(500).json({ message: 'Error during resume generation.' });
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`LaTeX service listening on port ${port}`));