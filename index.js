const path = require("path");
const uploadToGoogleDrive = require("./uploadToGdrive");

const run = async (job, settings, action, type) => {
  if (type !== "postrender") {
    throw new Error(
      `[nexrender-action-upload-google-drive] Action can only be run in postrender mode, you provided: ${type}.`
    );
  }

  const { logger } = settings;
  const {
    input,
    params: { base64Credentials, newFileName },
  } = action;

  // Validate required parameters
  if (!base64Credentials) {
    throw new Error(`[nexrender-action-upload-google-drive] Missing base64Credentials.`);
  }

  if (!newFileName) {
    throw new Error(`[nexrender-action-upload-google-drive] Missing newFileName.`);
  }

  try {
    // Determine the file path
    let finalInput = input ?? job.output;
    if (!path.isAbsolute(finalInput)) {
      finalInput = path.join(job.workpath, finalInput);
    }

    logger.log(
      `[nexrender-action-upload-google-drive] Uploading file to Google Drive: ${finalInput}`
    );

    // Upload the file using the uploadToGoogleDrive module
    const fileId = await uploadToGoogleDrive(
      base64Credentials,
      finalInput,
      newFileName,
      logger
    );

    logger.log(
      `[nexrender-action-upload-google-drive] File uploaded successfully to Google Drive with ID: ${fileId}`
    );
  } catch (error) {
    logger.log(
      `[nexrender-action-upload-google-drive] Failed to upload file: ${error.message}`
    );
    throw error;
  }
};

module.exports = run;
