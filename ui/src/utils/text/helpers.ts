// Add files to form data with validation
const addFileToFormData = (
  formData: FormData,
  fieldName: string,
  file: File | null | undefined,
  maxSizeMB = 5
) => {
  if (!file) {
    throw new Error(`${fieldName} file is required`);
  }

  if (file.size > maxSizeMB * 1024 * 1024) {
    throw new Error(`${fieldName} file size must be less than ${maxSizeMB}MB`);
  }

  formData.append(fieldName, file);
};

// Handle name input change
export const handleNameInputChange = (
  e: React.ChangeEvent<HTMLInputElement>,
  onChange: (value: string) => void,
  transformValue: (value: string) => string = (v) => v
) => {
  const input = e.target;
  const start = input.selectionStart;
  const end = input.selectionEnd;
  const value = transformValue(input.value);

  onChange(value);

  // Restore cursor position after React rerender
  requestAnimationFrame(() => {
    input.selectionStart = start;
    input.selectionEnd = end;
  });
};

// Custom name validation function
export const validateName = (name: string = '') => {
  if (!name) return false;
  const words = name.trim().split(/\s+/);

  // Must have at least 2 words
  if (words.length < 2) return false;

  // First and last words must be at least 2 characters
  if (words[0].length < 2 || words[words.length - 1].length < 2) return false;

  // Middle parts can be single letters (for initials) or 2+ characters
  const middleWords = words.slice(1, -1);
  return middleWords.every((word) => word.length >= 1);
};

// Validate image file type
export const validateImageFile = (
  file: File | null | undefined
): { valid: boolean; message?: string } => {
  if (!file) {
    return { valid: false, message: 'No file selected' };
  }

  // List of valid image MIME types
  const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/heic'];

  if (!validTypes.includes(file.type)) {
    return {
      valid: false,
      message: 'Please upload only JPG, JPEG, PNG or HEIC image formats',
    };
  }

  return { valid: true };
};

// Fetches an image from a URL and converts it to a File object
export const fetchImageAsFile = async (
  imageUrl: string,
  primaryGuestName: string
): Promise<File | null> => {
  try {
    const imageResponse = await fetch(imageUrl);

    if (!imageResponse.ok) {
      console.error(`Failed to fetch image: ${imageResponse.status} ${imageResponse.statusText}`);
      return null;
    }

    const blob = await imageResponse.blob();

    // Extract the filename from the URL
    const urlFileName = imageUrl.split('/').pop() || '';

    // Get guest name index
    const formattedGuestName = formatName(primaryGuestName);
    const guestNameIndex = urlFileName.indexOf(formattedGuestName);

    // Get the start index (after guest name and underscore)
    const startIndex = guestNameIndex + formattedGuestName.length + 1;
    // Get the end index (before file extension)
    const extensionIndex = urlFileName.lastIndexOf('.');

    if (extensionIndex > startIndex) {
      const fileName = urlFileName.substring(startIndex, extensionIndex);
      const fileExtension = urlFileName.substring(extensionIndex);
      const newFileName = fileName + fileExtension;
      return new File([blob], newFileName, { type: blob.type });
    }

    return new File([blob], urlFileName, { type: blob.type });
  } catch (error) {
    console.error('Error fetching image:', error);
    return null;
  }
};

// Format a full name for file naming (convert to lowercase with underscores and remove special characters)
const formatName = (fullName: string): string => {
  return (
    fullName
      .toLowerCase()
      .trim()
      // Normalize to decompose accented characters and remove diacritical marks
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      // Replace spaces with underscores
      .replace(/\s+/g, '_')
      // Remove any characters that are not alphanumeric, underscore, dash, or period
      .replace(/[^a-z0-9_.-]/g, '')
  );
};

// Generate a standardized filename for uploads
const generateFileName = (
  prefix: string,
  fullName: string,
  checkInDate: string,
  checkOutDate: string,
  originalFileName: string
): string => {
  const formattedName = formatName(fullName);

  // Create a deterministic filename without including the original filename
  // This ensures the same file name is generated for the same guest and dates
  return `${prefix}_${checkInDate}_${checkOutDate}_${formattedName}_${originalFileName}`;
};

// Handle file upload with standardized naming and form data appending
export const handleFileUpload = (
  formData: FormData,
  file: File | null | undefined,
  prefix: string,
  primaryGuestName: string,
  checkInDate: string,
  checkOutDate: string,
  isRequired: boolean = true,
  maxSizeMB: number = 5
): void => {
  // If file is not provided and it's required, throw error
  if (!file && isRequired) {
    throw new Error(`${prefix} file is required`);
  }

  // If no file and not required, return early
  if (!file) {
    return;
  }

  // Generate standardized filename
  const fileName = generateFileName(prefix, primaryGuestName, checkInDate, checkOutDate, file.name);

  // Add file and filename to form data
  addFileToFormData(formData, prefix, file, maxSizeMB);
  formData.append(`${prefix}FileName`, fileName);
};
