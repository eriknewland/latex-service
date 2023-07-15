const express = require('express');
const cors = require('cors');
const axios = require('axios');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const { getDoc, doc, updateDoc } = require('firebase/firestore');
const { getStorage, ref, uploadBytes, getDownloadURL } = require('firebase/storage');
const { db, storage } = require('../firebase'); // make sure to move your firebase.js file to this service

const app = express();

app.use(cors());
app.use(express.json());

async function fetchData(userUid, jobDescription, jobId) {
  try {
    // Fetch user's profile from Firebase
    const userDoc = await getDoc(doc(db, 'profiles', userUid));
    const userProfile = userDoc.data();
    // console.log(JSON.stringify(userProfile, null, 2))
    // console.log('this is userProfile: ', userProfile)
    const completionRequest = {
        model: 'gpt-4',
        messages: [
        {
            role: 'system',
            content:
            `You are LaTex-AI, an AI designed to create personalized LaTex resumes for job applicants based on the template provided and user instructions. DO NOT use placeholder values or hallucinate if the provided user profile is incomplete. The user's information will be presented as a JSON string. You will only return the LaTex code as your response will immediately be written to a .tex file. Your template is:\n ${latexString}.\n The accompanying .cls file is:\n ${latexFormat}. `,
        },
        { role: 'user', content: `Create a personalized resume for the following user profile:\n${JSON.stringify(userProfile, null, 2)}\n\nThe job description is:\n${jobDescription}\n\nPlease generate a custom LaTex resume based on the provided template and user profile.` },
        ],
        temperature: 0.10,
    };
    // console.log(JSON.stringify(userProfile, null, 2))

    function escapeLaTeXInJSON(json) {
      for (var key in json) {
          if (typeof json[key] === 'string') {
              json[key] = escapeLaTeX(json[key]);
          } else if (typeof json[key] === 'object') {
              json[key] = escapeLaTeXInJSON(json[key]);
          }
      }
      return json;
  }

  function escapeLaTeX(str) {
      var map = {
          '#': '\\#',
          '$': '\\$',
          '%': '\\%',
          '^': '\\^{}',
          '&': '\\&',
          '_': '\\_',
          '{': '\\{',
          '}': '\\}',
          '~': '\\~{}',
          '\\': '\\textbackslash{}'
      };

      var regex = new RegExp(Object.keys(map).join('|').replace(/\\/g, '\\\\'), 'g');

      return str.replace(regex, function(match) {
          return map[match] || match;
      });
  }

  const sanitizedUserData = escapeLaTeXInJSON(userProfile);
    console.log('this is clean data:\n', sanitizedUserData)
    const completionRequestTest = {
      model: 'gpt-4',
      messages: [
      {
          role: 'system',
          content:
          `you are LaTex-AI, an AI designed to create personalized resumes in .tex format. You are deeply experienced in creating professional resumés that secure applicants the job. You will only return the code. You will create personalized resumés relative to each provided job description, and a JSON string representing the applicant's information. Include "pagestyle{empty}" to ensure there is no page numbering. If there are more than 5 'skills' presented, list them both horizontally and vertically in sub-groups. Improve the language of the user's job and project descriptions whenever possible. You will follow proper LaTex syntax and create a clean, minimalist, professional resumé. You may only use (but are not required to use) the following packages: geometry, parskip, keycommand, xstring, hyperref, helvet, fontenc, enumitem`,
      },
      { role: 'user', content: `Create a personalized resume for the following user profile. Please list the URL as a string instead of a link presented with links:\n${JSON.stringify(sanitizedUserData, null, 2)}\n\nThe job description is:\n${jobDescription}\n\n` },
      ],
      temperature: 0.10,
  };

    const response = await axios.post(API_ENDPOINT, completionRequestTest, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${API_KEY}`,
      },
    });

    const result = response.data.choices[0].message.content;
    // console.log('this is the result: ', result)
    const tempTexFile = path.join(process.cwd(), 'temp', 'temp.tex');
    fs.writeFileSync(tempTexFile, result);

    await convertAndStore(userUid, jobId);
  } catch (error) {
    console.error(error);
    throw error; // re-throw the error
  }
}
async function convertAndStore(userUid, jobId) {
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

  const pdfBuffer = fs.readFileSync(path.join(tempDir, 'temp.pdf'));
  const storageRef = ref(storage, `resumes/${userUid}/${jobId}/resume.pdf`); // Use the ref function from the modular version
  await uploadBytes(storageRef, pdfBuffer); // Use the uploadBytes function to upload the file

  pdfUrl = await getDownloadURL(storageRef); // Get the download URL
  console.log('PDF URL:', pdfUrl);

  // Update the user's profile with the resume URL
  const firestoreDocRef = doc(db, `profiles`, userUid, `jobs`, jobId);
  // console.log('Firestore document reference:', firestoreDocRef);
  await updateDoc(firestoreDocRef, { resumeUrl: pdfUrl });
  // console.log('Firestore document updated with resume URL');

  // Delete intermediate files
  const filesToDelete = [
    path.join(tempDir, `${texFile.split('.')[0]}.aux`),
    path.join(tempDir, `${texFile.split('.')[0]}.log`),
    path.join(tempDir, `${texFile.split('.')[0]}.out`),
    path.join(tempDir, `${texFile.split('.')[0]}.pdf`),
    path.join(tempDir, `${texFile.split('.')[0]}.tex`),
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
} catch (error) {
  console.error('Error during PDF generation or storage:', error);
  throw error;  // Propagate the error back to the caller
}
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