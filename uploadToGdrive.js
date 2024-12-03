const fs = require("fs");
const axios = require("axios");
const crypto = require("crypto");

/**
 * Uploads a file to Google Drive in a specified folder, creating the folder if it doesn't exist.
 * Handles file name conflicts by appending a hash to the file name.
 * @param {string} base64Credentials - Base64 encoded Google account credentials JSON.
 * @param {string} folderUrl - Google Drive folder URL where the composition folder will be created.
 * @param {string} compositionName - Name of the composition folder.
 * @param {string} filePath - Path of the file to upload.
 * @param {string} fileName - Desired file name for the uploaded file.
 * @param {object} logger - Logger for logging information or errors.
 * @param {string} driveId - The ID of the shared drive where the file will be uploaded.
 */
const uploadToGoogleDrive = async (
  base64Credentials,
  folderUrl,
  compositionName,
  filePath,
  fileName,
  logger,
  driveId
) => {
  try {
    // Decode the base64 credentials
    const credentialsJson = Buffer.from(base64Credentials, "base64").toString("utf8");
    const credentials = JSON.parse(credentialsJson);

    // Authenticate and get an access token
    const tokenResponse = await axios.post(
      "https://oauth2.googleapis.com/token",
      {
        client_id: credentials.client_id,
        client_secret: credentials.client_secret,
        refresh_token: credentials.refresh_token,
        grant_type: "refresh_token",
      }
    );
    const accessToken = tokenResponse.data.access_token;

    // Extract folderId from folderUrl
    const folderIdMatch = folderUrl.match(/\/folders\/([^\/]+)/);
    if (!folderIdMatch) {
      throw new Error(`[Google Drive] Invalid folder URL: ${folderUrl}`);
    }
    const folderId = folderIdMatch[1];
    logger.log(`Folder ID: ${folderId}`);
    logger.log(`Drive ID: ${driveId}`);

    // Step 1: Verify parent folder
    const folderMetadataResponse = await axios.get(
      `https://www.googleapis.com/drive/v3/files/${folderId}`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
        params: { fields: "id, name, parents, driveId, trashed", supportsAllDrives: true },
      }
    );
    const folderMetadata = folderMetadataResponse.data;
    if (folderMetadata.trashed) {
      throw new Error(`[Google Drive] Parent folder is in the trash.`);
    }
    logger.log(`[Google Drive] Parent folder verified: ${folderMetadata.name} (ID: ${folderMetadata.id})`);

    // Step 2: Search for the composition folder
    const searchFolderResponse = await axios.get(
      "https://www.googleapis.com/drive/v3/files",
      {
        headers: { Authorization: `Bearer ${accessToken}` },
        params: {
          q: `'${folderId}' in parents and name = '${compositionName}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
          fields: "files(id, name)",
          includeItemsFromAllDrives: true,
          supportsAllDrives: true,
        },
      }
    );

    let compositionFolder;
    if (searchFolderResponse.data.files.length > 0) {
      compositionFolder = searchFolderResponse.data.files[0];
      logger.log(`[Google Drive] Folder exists: ${compositionFolder.name} (ID: ${compositionFolder.id})`);
    } else {
      logger.log(`[Google Drive] Folder doesn't exist, creating: ${compositionName}`);
      const createFolderResponse = await axios.post(
        "https://www.googleapis.com/drive/v3/files",
        {
          name: compositionName,
          mimeType: "application/vnd.google-apps.folder",
          parents: [folderId],
        },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          params: { supportsAllDrives: true },
        }
      );
      compositionFolder = createFolderResponse.data;
      logger.log(`[Google Drive] Folder created: ${compositionFolder.name} (ID: ${compositionFolder.id})`);
    }

    // Step 3: Handle file name conflicts
    let finalFileName = fileName;
    const searchFileResponse = await axios.get(
      "https://www.googleapis.com/drive/v3/files",
      {
        headers: { Authorization: `Bearer ${accessToken}` },
        params: {
          q: `'${compositionFolder.id}' in parents and name = '${fileName}' and trashed = false`,
          fields: "files(id, name)",
          includeItemsFromAllDrives: true,
          supportsAllDrives: true,
        },
      }
    );

    if (searchFileResponse.data.files.length > 0) {
      const randomHash = crypto.randomBytes(4).toString("hex");
      finalFileName = `${fileName}_copy_${randomHash}`;
      logger.log(`[Google Drive] File name conflict. New name: ${finalFileName}`);
    }

    // Step 4: Upload the file
    const fileStream = fs.createReadStream(filePath);
    const uploadResponse = await axios.post(
      "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart",
      {
        metadata: {
          name: finalFileName,
          parents: [compositionFolder.id],
        },
        media: {
          mimeType: "application/octet-stream", // Adjust MIME type as needed
          body: fileStream,
        },
      },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      }
    );

    logger.log(`[Google Drive] File uploaded: ${uploadResponse.data.name} (ID: ${uploadResponse.data.id})`);
    return uploadResponse.data.id; // Return the file ID
  } catch (error) {
    logger.log(`[Google Drive] Error: ${error.response?.data?.error?.message || error.message}`);
    throw error;
  }
};

module.exports = uploadToGoogleDrive;
