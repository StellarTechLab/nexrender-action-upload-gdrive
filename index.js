const path = require("path");
const { spawn } = require("child_process");

/**
 * Main function to run the script.
 * @param {object} job - Nexrender job object.
 * @param {object} settings - Nexrender settings object.
 * @param {object} action - Action object containing parameters for the file upload.
 * @param {string} type - Type of the action being executed (e.g., "postrender").
 */
const run = async (job, settings, action, type) => {
  if (type !== "postrender") {
    throw new Error(
      `[nexrender-action-upload-google-drive] Action can only be run in postrender mode, you provided: ${type}.`
    );
  }

  const { logger } = settings;

  // Validate required parameter
  if (!action.uploadScriptPath) {
    throw new Error(`[nexrender-action-upload-google-drive] Missing uploadScriptPath.`);
  }

  try {
    // Determine the file path
    let finalInput = job.output;
    if (!path.isAbsolute(finalInput)) {
      finalInput = path.join(job.workpath, finalInput);
    }

    logger.log(
      `[nexrender-action-upload-google-drive] Uploading file to Google Drive: ${finalInput}`
    );

    // Ensure the uploadScriptPath is an absolute path
    const uploadScriptPath = path.isAbsolute(action.uploadScriptPath)
      ? action.uploadScriptPath
      : path.join(process.cwd(), action.uploadScriptPath);

    logger.log(
      `[nexrender-action-upload-google-drive] Running Python script at: ${uploadScriptPath}`
    );

    // Run the Python uploader directly
    const pythonProcess = spawn('python3', [
      uploadScriptPath,
      finalInput
    ]);

    pythonProcess.stdout.on('data', (data) => {
      logger.log(`[Python] ${data.toString().trim()}`);
    });

    pythonProcess.stderr.on('data', (data) => {
      logger.error(`[Python Error] ${data.toString().trim()}`);
    });

    const exitCode = await new Promise((resolve) => {
      pythonProcess.on('close', resolve);
    });

    if (exitCode === 0) {
      logger.log('[nexrender-action-upload-google-drive] Python script completed successfully.');
    } else {
      logger.error(`[nexrender-action-upload-google-drive] Python script exited with code ${exitCode}`);
      throw new Error(`[nexrender-action-upload-google-drive] Python script failed with exit code ${exitCode}`);
    }

  } catch (error) {
    logger.log(
      `[nexrender-action-upload-google-drive] Failed to upload file: ${error.message}`
    );
    throw error;
  }
};

module.exports = run;
