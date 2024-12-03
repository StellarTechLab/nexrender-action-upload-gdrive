const path = require("path");
const uploadToGoogleDrive = require("./uploadToGoogleDrive");

const run = async (job, settings, action, type) => {
  if (type !== "postrender") {
    throw new Error(
      `[nexrender-action-upload-google-drive] Action can only be run in postrender mode, you provided: ${type}.`
    );
  }

  const { logger } = settings;
  const {
    input,
    params: { base64Credentials, folderUrl, compositionName, fileName },
  } = action;

  if (!base64Credentials || !folderUrl || !compositionName || !fileName) {
    throw new Error(
      `[nexrender-action-upload-google-drive] Missing required parameters: base64Credentials, folderUrl, compositionName, fileName.`
    );
  }

  try {
    // Extract the folder ID from the folder URL
    const folderIdMatch = folderUrl.match(/\/folders\/([^\/]+)/);
    if (!folderIdMatch) {
      throw new Error(`[nexrender-action-upload-google-drive] Invalid folder URL: ${folderUrl}`);
    }
    const folderId = folderIdMatch[1];

    // Determine the file path: Use `input` or default to `job.output`
    let finalInput = input ?? job.output;
    if (!path.isAbsolute(finalInput)) {
      finalInput = path.join(job.workpath, finalInput);
    }

    // Log the file location
    logger.log(
      `[Google Drive Runner] Preparing to upload file: ${finalInput} to folder: ${folderUrl}`
    );

    // Call the upload function
    await uploadToGoogleDrive(
      base64Credentials,
      folderId,
      compositionName,
      finalInput,
      fileName,
      logger
    );

    logger.log(`[Google Drive Runner] Upload complete.`);
  } catch (error) {
    logger.log(`[Google Drive Runner] Error: ${error.message}`);
    throw error;
  }
};

module.exports = run;
