// script.js

// --- Global Elements and State ---
const loadingOverlay = document.getElementById('loading-overlay');
const loadingMessage = document.getElementById('loading-message');
let currentTool = 'home-section'; // Track the currently active tool section

const selectedFiles = {}; // Stores files for each tool: { toolId: [File objects] }
const processedResults = {}; // Stores processed results (Blobs/URLs) for each tool: { toolId: [Blob/URL] }

// --- Utility Functions ---

function showLoading(message = 'Processing...') {
    loadingMessage.textContent = message;
    loadingOverlay.style.display = 'flex';
}

function hideLoading() {
    loadingOverlay.style.display = 'none';
}

function updateSelectedFilesList(toolId, files) {
    const listElement = document.getElementById(`${toolId}-selected-files`);
    listElement.innerHTML = '';
    if (files.length > 0) {
        files.forEach((file, index) => {
            const listItem = document.createElement('li');
            listItem.className = 'flex justify-between items-center bg-gray-100 p-2 rounded-md mb-2';
            listItem.innerHTML = `
                <span>${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)</span>
                <button type="button" class="remove-file text-red-500 hover:text-red-700" data-index="${index}" data-tool-id="${toolId}">Remove</button>
            `;
            listElement.appendChild(listItem);
        });
        document.getElementById(`${toolId}-options`).classList.remove('hidden');
    } else {
        document.getElementById(`${toolId}-options`).classList.add('hidden');
    }
}

function addDownloadButton(containerId, blob, filename) {
    const container = document.getElementById(containerId);
    const button = document.createElement('button');
    button.className = 'mt-4 px-4 py-2 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500';
    button.textContent = `Download ${filename.split('.').pop().toUpperCase()} (${filename})`;
    button.onclick = () => saveAs(blob, filename);
    container.appendChild(button);
}

// Function to handle file input change and drag/drop
function setupFileInput(toolId, inputId, dropAreaId, multiple = false) {
    const fileInput = document.getElementById(inputId);
    const dropArea = document.getElementById(dropAreaId);

    // Initialize selectedFiles for this tool
    selectedFiles[toolId] = [];

    // Click to upload
    dropArea.addEventListener('click', () => fileInput.click());

    // File input change
    fileInput.addEventListener('change', (event) => {
        const files = Array.from(event.target.files);
        if (!multiple) {
            selectedFiles[toolId] = files.slice(0, 1); // Only allow one file
        } else {
            selectedFiles[toolId] = files;
        }
        updateSelectedFilesList(toolId, selectedFiles[toolId]);
    });

    // Drag and drop events
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropArea.addEventListener(eventName, preventDefaults, false);
        document.body.addEventListener(eventName, preventDefaults, false); // Prevent default for whole document
    });

    ['dragenter', 'dragover'].forEach(eventName => {
        dropArea.addEventListener(eventName, () => dropArea.classList.add('active'), false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        dropArea.addEventListener(eventName, () => dropArea.classList.remove('active'), false);
    });

    dropArea.addEventListener('drop', (event) => {
        const dt = event.dataTransfer;
        const files = Array.from(dt.files);
        if (!multiple) {
            selectedFiles[toolId] = files.slice(0, 1); // Only allow one file
        } else {
            selectedFiles[toolId] = files;
        }
        updateSelectedFilesList(toolId, selectedFiles[toolId]);
    }, false);

    // Handle removing files from the list
    document.getElementById(`${toolId}-selected-files`).addEventListener('click', (event) => {
        if (event.target.classList.contains('remove-file')) {
            const indexToRemove = parseInt(event.target.dataset.index);
            const toolId = event.target.dataset.toolId;
            selectedFiles[toolId].splice(indexToRemove, 1);
            updateSelectedFilesList(toolId, selectedFiles[toolId]);
            // Hide options/results if no files left
            if (selectedFiles[toolId].length === 0) {
                document.getElementById(`${toolId}-options`).classList.add('hidden');
                document.getElementById(`${toolId}-results`).classList.add('hidden');
            }
        }
    });
}

function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
}

function setupImageCompareSlider(containerId, originalImgId, processedImgId, wrapperId, sliderId) {
    const container = document.getElementById(containerId);
    const originalImg = document.getElementById(originalImgId);
    const processedImg = document.getElementById(processedImgId);
    const processedWrapper = document.getElementById(wrapperId);
    const slider = document.getElementById(sliderId);

    let isDragging = false;

    if (!container || !originalImg || !processedImg || !processedWrapper || !slider) {
        console.warn(`Missing elements for image comparison slider: ${containerId}`);
        return;
    }

    // Reset initial state
    processedWrapper.style.width = '50%';
    slider.style.left = '50%';

    const onMouseMove = (e) => {
        if (!isDragging) return;

        let x = e.clientX - container.getBoundingClientRect().left;
        let containerWidth = container.offsetWidth;

        if (x < 0) x = 0;
        if (x > containerWidth) x = containerWidth;

        processedWrapper.style.width = `${x}px`;
        slider.style.left = `${x}px`;
    };

    const onMouseUp = () => {
        isDragging = false;
        container.removeEventListener('mousemove', onMouseMove);
        container.removeEventListener('mouseup', onMouseUp);
        container.removeEventListener('mouseleave', onMouseUp); // Release if mouse leaves container
    };

    slider.addEventListener('mousedown', (e) => {
        isDragging = true;
        container.addEventListener('mousemove', onMouseMove);
        container.addEventListener('mouseup', onMouseUp);
        container.addEventListener('mouseleave', onMouseUp);
    });
}


// --- Navigation and Tool Switching ---
document.addEventListener('DOMContentLoaded', () => {
    const navLinks = document.querySelectorAll('.nav-link');
    const useToolButtons = document.querySelectorAll('.use-tool-button');
    const mobileMenuButton = document.getElementById('mobile-menu-button');
    const mobileMenu = document.getElementById('mobile-menu');
    const homeLink = document.getElementById('home-link');

    // Show initial home section
    showSection('home-section');

    function showSection(sectionId) {
        // Hide all tool sections
        document.querySelectorAll('.tool-section').forEach(section => {
            section.classList.remove('active');
        });
        // Show the target section
        document.getElementById(sectionId).classList.add('active');
        currentTool = sectionId; // Update current tool state

        // Reset file inputs and previews when switching tools
        Object.keys(selectedFiles).forEach(toolId => {
            selectedFiles[toolId] = [];
            const inputElement = document.getElementById(`${toolId}-file-input`);
            if (inputElement) inputElement.value = null; // Clear file input
            updateSelectedFilesList(toolId, []);
            document.getElementById(`${toolId}-results`)?.classList.add('hidden'); // Hide results
            document.getElementById(`${toolId}-options`)?.classList.add('hidden'); // Hide options
        });

        // Specific cleanup for image/video previews
        document.querySelectorAll('img.w-full.h-full.object-contain').forEach(img => img.src = '');
        document.querySelectorAll('video.w-full.max-h-96.object-contain').forEach(video => video.src = '');
        document.querySelectorAll('[id$="-placeholder"]').forEach(placeholder => placeholder.classList.remove('hidden'));
        document.querySelectorAll('[id^="download-buttons-"]').forEach(btnGroup => btnGroup.innerHTML = '');

        // Re-initialize any preview sliders for the new active section if needed
        // This is handled by the tool-specific logic upon successful processing, but a reset might be good.
        document.querySelectorAll('.image-compare-container').forEach(container => {
            const wrapper = container.querySelector('.after-image-wrapper');
            const slider = container.querySelector('.image-compare-slider');
            if (wrapper) wrapper.style.width = '50%';
            if (slider) slider.style.left = '50%';
        });
    }

    // Nav links
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const targetSectionId = link.dataset.toolSection;
            showSection(targetSectionId);
            mobileMenu.classList.add('hidden'); // Hide mobile menu on selection
        });
    });

    // Home link in nav
    homeLink.addEventListener('click', (e) => {
        e.preventDefault();
        showSection('home-section');
        mobileMenu.classList.add('hidden');
    });

    // Use Tool buttons (from home screen)
    useToolButtons.forEach(button => {
        button.addEventListener('click', (e) => {
            e.preventDefault();
            const targetToolId = button.dataset.toolTarget;
            showSection(targetToolId);
        });
    });

    // Mobile menu toggle
    mobileMenuButton.addEventListener('click', () => {
        mobileMenu.classList.toggle('hidden');
    });

    // --- Tool-Specific Implementations ---

    // --- Image Compressor ---
    setupFileInput('image-compressor', 'compressor-file-input', 'compressor-drop-area');
    const qualitySlider = document.getElementById('quality-slider');
    const qualityValueSpan = document.getElementById('quality-value');
    qualitySlider.addEventListener('input', () => {
        qualityValueSpan.textContent = qualitySlider.value;
    });

    document.getElementById('compress-image-button').addEventListener('click', async () => {
        const files = selectedFiles['image-compressor'];
        if (files.length === 0) {
            alert('Please select an image to compress.');
            return;
        }

        showLoading('Compressing image...');
        const imageFile = files[0]; // Assuming single image for now
        const quality = parseFloat(qualitySlider.value) / 100;

        try {
            const compressedBlob = await new Compressor(imageFile, {
                quality: quality,
                mimeType: 'image/jpeg', // Force output to JPEG for consistent compression
                success(result) {
                    // This is where the Blob is returned
                },
                error(err) {
                    console.error(err.message);
                    alert('Error compressing image: ' + err.message);
                    hideLoading();
                },
            });

            // Read original image for preview
            const originalImageURL = URL.createObjectURL(imageFile);
            const compressedImageURL = URL.createObjectURL(compressedBlob);

            document.getElementById('original-image-preview').src = originalImageURL;
            document.getElementById('compressed-image-preview').src = compressedImageURL;

            // Update size info
            document.getElementById('original-size').textContent = `${(imageFile.size / 1024).toFixed(2)} KB`;
            document.getElementById('compressed-size').textContent = `${(compressedBlob.size / 1024).toFixed(2)} KB`;
            const reduction = ((imageFile.size - compressedBlob.size) / imageFile.size * 100).toFixed(2);
            document.getElementById('size-reduction').textContent = `${reduction}%`;

            // Setup preview slider
            setupImageCompareSlider(
                'compressor-compare-container',
                'original-image-preview',
                'compressed-image-preview',
                'compressed-image-wrapper',
                'compressor-slider'
            );

            // Store result for download
            processedResults['image-compressor'] = [compressedBlob];
            const downloadContainer = document.getElementById('download-buttons-compressor');
            downloadContainer.innerHTML = ''; // Clear previous buttons
            addDownloadButton(downloadContainer.id, compressedBlob, `compressed_${imageFile.name.split('.')[0]}.jpeg`);

            document.getElementById('compressor-results').classList.remove('hidden');
        } catch (error) {
            console.error('Compression failed:', error);
            alert('Compression failed: ' + error.message);
        } finally {
            hideLoading();
        }
    });

    // --- Image Converter ---
    setupFileInput('image-converter', 'converter-file-input', 'converter-drop-area');
    const outputFormatSelect = document.getElementById('output-format');

    document.getElementById('convert-image-button').addEventListener('click', async () => {
        const files = selectedFiles['image-converter'];
        if (files.length === 0) {
            alert('Please select an image to convert.');
            return;
        }

        showLoading('Converting image...');
        const imageFile = files[0];
        const outputFormat = outputFormatSelect.value;
        let mimeType;
        let fileExtension;

        switch (outputFormat) {
            case 'png':
                mimeType = 'image/png';
                fileExtension = 'png';
                break;
            case 'jpeg':
                mimeType = 'image/jpeg';
                fileExtension = 'jpeg';
                break;
            case 'webp':
                mimeType = 'image/webp';
                fileExtension = 'webp';
                break;
            // case 'gif': // Direct single image to GIF conversion might not be the common use case. GIF.js is for multiple images.
            //     mimeType = 'image/gif';
            //     fileExtension = 'gif';
            //     break;
            default:
                mimeType = 'image/jpeg';
                fileExtension = 'jpeg';
        }

        try {
            // Use Canvas to draw and convert
            const img = new Image();
            img.src = URL.createObjectURL(imageFile);
            await new Promise(resolve => img.onload = resolve);

            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);

            const convertedBlob = await new Promise(resolve => {
                canvas.toBlob(resolve, mimeType);
            });

            const originalImageURL = URL.createObjectURL(imageFile);
            const convertedImageURL = URL.createObjectURL(convertedBlob);

            document.getElementById('converter-original-image-preview').src = originalImageURL;
            document.getElementById('converter-converted-image-preview').src = convertedImageURL;

            setupImageCompareSlider(
                'converter-compare-container',
                'converter-original-image-preview',
                'converter-converted-image-preview',
                'converter-converted-image-wrapper',
                'converter-slider'
            );

            processedResults['image-converter'] = [convertedBlob];
            const downloadContainer = document.getElementById('download-buttons-converter');
            downloadContainer.innerHTML = '';
            addDownloadButton(downloadContainer.id, convertedBlob, `${imageFile.name.split('.')[0]}.${fileExtension}`);

            document.getElementById('converter-results').classList.remove('hidden');

        } catch (error) {
            console.error('Conversion failed:', error);
            alert('Conversion failed: ' + error.message);
        } finally {
            hideLoading();
        }
    });

    // --- Image Resizer ---
    setupFileInput('image-resizer', 'resizer-file-input', 'resizer-drop-area');
    const resizeWidthInput = document.getElementById('resize-width');
    const resizeHeightInput = document.getElementById('resize-height');
    const maintainAspectRatioCheckbox = document.getElementById('maintain-aspect-ratio');

    document.getElementById('resize-image-button').addEventListener('click', async () => {
        const files = selectedFiles['image-resizer'];
        if (files.length === 0) {
            alert('Please select an image to resize.');
            return;
        }

        showLoading('Resizing image...');
        const imageFile = files[0];
        let targetWidth = parseInt(resizeWidthInput.value);
        let targetHeight = parseInt(resizeHeightInput.value);
        const maintainAspectRatio = maintainAspectRatioCheckbox.checked;

        try {
            const img = new Image();
            img.src = URL.createObjectURL(imageFile);
            await new Promise(resolve => img.onload = resolve);

            let originalWidth = img.width;
            let originalHeight = img.height;

            if (maintainAspectRatio) {
                if (targetWidth && !targetHeight) {
                    targetHeight = (originalHeight / originalWidth) * targetWidth;
                } else if (!targetWidth && targetHeight) {
                    targetWidth = (originalWidth / originalHeight) * targetHeight;
                } else if (!targetWidth && !targetHeight) {
                    alert('Please enter at least one dimension (width or height) or both to resize.');
                    hideLoading();
                    return;
                } else if (targetWidth && targetHeight) {
                    // If both are provided, calculate scale based on smallest fit to maintain aspect ratio
                    const aspectRatio = originalWidth / originalHeight;
                    const newAspectRatio = targetWidth / targetHeight;

                    if (newAspectRatio > aspectRatio) {
                        targetWidth = targetHeight * aspectRatio;
                    } else {
                        targetHeight = targetWidth / aspectRatio;
                    }
                }
            } else { // Do not maintain aspect ratio
                if (!targetWidth || !targetHeight) {
                     alert('Please enter both width and height to resize without maintaining aspect ratio.');
                     hideLoading();
                     return;
                }
            }

            const canvas = document.createElement('canvas');
            canvas.width = targetWidth || originalWidth;
            canvas.height = targetHeight || originalHeight;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

            const resizedBlob = await new Promise(resolve => {
                canvas.toBlob(resolve, imageFile.type); // Keep original mime type
            });

            const originalImageURL = URL.createObjectURL(imageFile);
            const resizedImageURL = URL.createObjectURL(resizedBlob);

            document.getElementById('resizer-original-image-preview').src = originalImageURL;
            document.getElementById('resizer-resized-image-preview').src = resizedImageURL;

            setupImageCompareSlider(
                'resizer-compare-container',
                'resizer-original-image-preview',
                'resizer-resized-image-preview',
                'resizer-resized-image-wrapper',
                'resizer-slider'
            );

            processedResults['image-resizer'] = [resizedBlob];
            const downloadContainer = document.getElementById('download-buttons-resizer');
            downloadContainer.innerHTML = '';
            addDownloadButton(downloadContainer.id, resizedBlob, `resized_${imageFile.name}`);

            document.getElementById('resizer-results').classList.remove('hidden');

        } catch (error) {
            console.error('Resizing failed:', error);
            alert('Resizing failed: ' + error.message);
        } finally {
            hideLoading();
        }
    });

    // --- Watermark Tool ---
    setupFileInput('watermark-tool', 'watermark-file-input', 'watermark-drop-area');
    const watermarkTypeSelect = document.getElementById('watermark-type');
    const textWatermarkOptions = document.getElementById('text-watermark-options');
    const imageWatermarkOptions = document.getElementById('image-watermark-options');
    const watermarkTextInput = document.getElementById('watermark-text');
    const textFontSizeInput = document.getElementById('text-font-size');
    const textColorInput = document.getElementById('text-color');
    const textOpacityInput = document.getElementById('text-opacity');
    const textOpacityValueSpan = document.getElementById('text-opacity-value');
    const watermarkImageInput = document.getElementById('watermark-image-input');
    const watermarkImagePreview = document.getElementById('watermark-image-preview');
    const imageOpacityInput = document.getElementById('image-opacity');
    const imageOpacityValueSpan = document.getElementById('image-opacity-value');
    const imageScaleInput = document.getElementById('image-scale');
    const imageScaleValueSpan = document.getElementById('image-scale-value');
    const watermarkPositionSelect = document.getElementById('watermark-position');

    // Initial state for watermark options
    watermarkTypeSelect.addEventListener('change', () => {
        if (watermarkTypeSelect.value === 'text') {
            textWatermarkOptions.classList.remove('hidden');
            imageWatermarkOptions.classList.add('hidden');
        } else {
            textWatermarkOptions.classList.add('hidden');
            imageWatermarkOptions.classList.remove('hidden');
        }
    });
    textOpacityInput.addEventListener('input', () => textOpacityValueSpan.textContent = textOpacityInput.value);
    imageOpacityInput.addEventListener('input', () => imageOpacityValueSpan.textContent = imageOpacityInput.value);
    imageScaleInput.addEventListener('input', () => imageScaleValueSpan.textContent = imageScaleInput.value);

    watermarkImageInput.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                watermarkImagePreview.src = e.target.result;
                watermarkImagePreview.classList.remove('hidden');
            };
            reader.readAsDataURL(file);
        } else {
            watermarkImagePreview.src = '';
            watermarkImagePreview.classList.add('hidden');
        }
    });


    document.getElementById('apply-watermark-button').addEventListener('click', async () => {
        const files = selectedFiles['watermark-tool'];
        if (files.length === 0) {
            alert('Please select an image to watermark.');
            return;
        }
        showLoading('Applying watermark...');
        const imageFile = files[0];

        try {
            const img = new Image();
            img.src = URL.createObjectURL(imageFile);
            await new Promise(resolve => img.onload = resolve);

            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);

            const watermarkType = watermarkTypeSelect.value;
            const position = watermarkPositionSelect.value;

            if (watermarkType === 'text') {
                const text = watermarkTextInput.value;
                const fontSize = parseInt(textFontSizeInput.value);
                const color = textColorInput.value;
                const opacity = parseFloat(textOpacityInput.value);

                ctx.font = `${fontSize}px Arial`;
                ctx.fillStyle = color;
                ctx.globalAlpha = opacity;
                ctx.textAlign = 'left';
                ctx.textBaseline = 'top';

                let x, y;
                const textMetrics = ctx.measureText(text);
                const textWidth = textMetrics.width;
                const textHeight = fontSize * 1.2; // Approximation for text height

                switch (position) {
                    case 'top-left': x = 10; y = 10; break;
                    case 'top-right': x = canvas.width - textWidth - 10; y = 10; break;
                    case 'bottom-left': x = 10; y = canvas.height - textHeight - 10; break;
                    case 'bottom-right': x = canvas.width - textWidth - 10; y = canvas.height - textHeight - 10; break;
                    case 'center': x = (canvas.width - textWidth) / 2; y = (canvas.height - textHeight) / 2; break;
                }
                ctx.fillText(text, x, y);

            } else if (watermarkType === 'image') {
                const watermarkFile = watermarkImageInput.files[0];
                if (!watermarkFile) {
                    alert('Please upload a watermark image.');
                    hideLoading();
                    return;
                }
                const watermarkImg = new Image();
                watermarkImg.src = URL.createObjectURL(watermarkFile);
                await new Promise(resolve => watermarkImg.onload = resolve);

                const opacity = parseFloat(imageOpacityInput.value);
                const scale = parseFloat(imageScaleInput.value);

                ctx.globalAlpha = opacity;

                const wmWidth = watermarkImg.width * scale;
                const wmHeight = watermarkImg.height * scale;

                let x, y;
                switch (position) {
                    case 'top-left': x = 10; y = 10; break;
                    case 'top-right': x = canvas.width - wmWidth - 10; y = 10; break;
                    case 'bottom-left': x = 10; y = canvas.height - wmHeight - 10; break;
                    case 'bottom-right': x = canvas.width - wmWidth - 10; y = canvas.height - wmHeight - 10; break;
                    case 'center': x = (canvas.width - wmWidth) / 2; y = (canvas.height - wmHeight) / 2; break;
                }
                ctx.drawImage(watermarkImg, x, y, wmWidth, wmHeight);
            }

            const watermarkedBlob = await new Promise(resolve => {
                canvas.toBlob(resolve, imageFile.type);
            });

            const originalImageURL = URL.createObjectURL(imageFile);
            const watermarkedImageURL = URL.createObjectURL(watermarkedBlob);

            document.getElementById('watermark-original-image-preview').src = originalImageURL;
            document.getElementById('watermark-processed-image-preview').src = watermarkedImageURL;

            setupImageCompareSlider(
                'watermark-compare-container',
                'watermark-original-image-preview',
                'watermark-processed-image-preview',
                'watermark-processed-image-wrapper',
                'watermark-slider'
            );

            processedResults['watermark-tool'] = [watermarkedBlob];
            const downloadContainer = document.getElementById('download-buttons-watermark');
            downloadContainer.innerHTML = '';
            addDownloadButton(downloadContainer.id, watermarkedBlob, `watermarked_${imageFile.name}`);

            document.getElementById('watermark-results').classList.remove('hidden');

        } catch (error) {
            console.error('Watermark failed:', error);
            alert('Watermark failed: ' + error.message);
        } finally {
            hideLoading();
            ctx.globalAlpha = 1.0; // Reset globalAlpha
        }
    });

    // --- Image Enhancer ---
    setupFileInput('image-enhancer', 'enhancer-file-input', 'enhancer-drop-area');
    const brightnessSlider = document.getElementById('brightness-slider');
    const brightnessValueSpan = document.getElementById('brightness-value');
    const contrastSlider = document.getElementById('contrast-slider');
    const contrastValueSpan = document.getElementById('contrast-value');
    const saturationSlider = document.getElementById('saturation-slider');
    const saturationValueSpan = document.getElementById('saturation-value');

    // Update value displays
    brightnessSlider.addEventListener('input', () => brightnessValueSpan.textContent = brightnessSlider.value);
    contrastSlider.addEventListener('input', () => contrastValueSpan.textContent = contrastSlider.value);
    saturationSlider.addEventListener('input', () => saturationValueSpan.textContent = saturationSlider.value);

    document.getElementById('apply-enhancer-button').addEventListener('click', async () => {
        const files = selectedFiles['image-enhancer'];
        if (files.length === 0) {
            alert('Please select an image to enhance.');
            return;
        }
        showLoading('Applying enhancements...');
        const imageFile = files[0];

        try {
            const img = new Image();
            img.src = URL.createObjectURL(imageFile);
            await new Promise(resolve => img.onload = resolve);

            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');

            // Apply filters using CSS filter property on canvas context
            const brightness = parseFloat(brightnessSlider.value) / 100;
            const contrast = parseFloat(contrastSlider.value) / 100;
            const saturation = parseFloat(saturationSlider.value) / 100;

            // Note: Canvas 2D context does not directly support CSS filters like brightness().
            // We need to apply these manually with pixel manipulation or draw to a temp canvas.
            // For simplicity and client-side feasibility without heavy libraries, we'll draw
            // the image, and then use CSS filters on the canvas element itself for preview.
            // For actual saving, we'd need to manually apply pixel filters if it's not a direct save.
            // A more robust solution would involve a library like CamanJS or manipulating ImageData.

            ctx.filter = `brightness(${brightness}) contrast(${contrast}) saturate(${saturation})`;
            ctx.drawImage(img, 0, 0);
            ctx.filter = 'none'; // Reset context filter for next draw operations

            const enhancedBlob = await new Promise(resolve => {
                canvas.toBlob(resolve, imageFile.type);
            });

            const originalImageURL = URL.createObjectURL(imageFile);
            const enhancedImageURL = URL.createObjectURL(enhancedBlob);

            document.getElementById('enhancer-original-image-preview').src = originalImageURL;
            document.getElementById('enhancer-processed-image-preview').src = enhancedImageURL;

            setupImageCompareSlider(
                'enhancer-compare-container',
                'enhancer-original-image-preview',
                'enhancer-processed-image-preview',
                'enhancer-processed-image-wrapper',
                'enhancer-slider'
            );

            processedResults['image-enhancer'] = [enhancedBlob];
            const downloadContainer = document.getElementById('download-buttons-enhancer');
            downloadContainer.innerHTML = '';
            addDownloadButton(downloadContainer.id, enhancedBlob, `enhanced_${imageFile.name}`);

            document.getElementById('enhancer-results').classList.remove('hidden');

        } catch (error) {
            console.error('Enhancement failed:', error);
            alert('Enhancement failed: ' + error.message);
        } finally {
            hideLoading();
        }
    });

    // --- GIF Maker (Images to GIF) ---
    setupFileInput('gif-maker-tool', 'gif-file-input', 'gif-drop-area', true); // Allow multiple files
    const gifDelayInput = document.getElementById('gif-delay');
    const gifDelayValueSpan = document.getElementById('gif-delay-value');
    const gifQualityInput = document.getElementById('gif-quality');
    const gifQualityValueSpan = document.getElementById('gif-quality-value');
    const generatedGifPreview = document.getElementById('generated-gif-preview');
    const gifPreviewPlaceholder = document.getElementById('gif-preview-placeholder');

    gifDelayInput.addEventListener('input', () => gifDelayValueSpan.textContent = gifDelayInput.value);
    gifQualityInput.addEventListener('input', () => gifQualityValueSpan.textContent = gifQualityInput.value);

    document.getElementById('create-gif-button').addEventListener('click', async () => {
        const files = selectedFiles['gif-maker-tool'];
        if (files.length < 2) { // Need at least 2 images for a GIF
            alert('Please select at least two images to create a GIF.');
            return;
        }

        showLoading('Creating GIF...');
        try {
            // Sort files by name to maintain a consistent order if dropped out of sequence
            files.sort((a, b) => a.name.localeCompare(b.name));

            const gif = new GIF({
                workers: 2, // Use web workers for better performance
                quality: parseInt(gifQualityInput.value),
                delay: parseInt(gifDelayInput.value),
                workerScript: 'https://cdnjs.cloudflare.com/ajax/libs/gif.js/0.2.0/gif.worker.js' // Path to gif.worker.js
            });

            const imagePromises = files.map(file => {
                return new Promise(resolve => {
                    const img = new Image();
                    img.onload = () => resolve(img);
                    img.src = URL.createObjectURL(file);
                });
            });

            const images = await Promise.all(imagePromises);

            images.forEach(img => {
                gif.addFrame(img, { delay: parseInt(gifDelayInput.value) });
            });

            gif.on('start', () => {
                loadingMessage.textContent = 'Rendering GIF... This might take a moment.';
            });
            gif.on('progress', (p) => {
                loadingMessage.textContent = `Rendering GIF: ${(p * 100).toFixed(0)}%`;
            });
            gif.on('finished', (blob) => {
                const gifURL = URL.createObjectURL(blob);
                generatedGifPreview.src = gifURL;
                generatedGifPreview.classList.remove('hidden');
                gifPreviewPlaceholder.classList.add('hidden');

                processedResults['gif-maker-tool'] = [blob];
                const downloadContainer = document.getElementById('download-buttons-gif');
                downloadContainer.innerHTML = '';
                addDownloadButton(downloadContainer.id, blob, `animated.gif`);

                document.getElementById('gif-results').classList.remove('hidden');
                hideLoading();
            });

            gif.render();

        } catch (error) {
            console.error('GIF creation failed:', error);
            alert('GIF creation failed: ' + error.message);
            hideLoading();
        }
    });

    // --- PDF Compressor ---
    setupFileInput('pdf-compressor', 'pdf-compressor-file-input', 'pdf-compressor-drop-area');
    const pdfCompressionLevelSelect = document.getElementById('pdf-compression-level');

    document.getElementById('compress-pdf-button').addEventListener('click', async () => {
        const files = selectedFiles['pdf-compressor'];
        if (files.length === 0) {
            alert('Please select a PDF to compress.');
            return;
        }
        showLoading('Compressing PDF...');
        const pdfFile = files[0];
        const compressionLevel = pdfCompressionLevelSelect.value; // low, medium, high

        try {
            const pdfBytes = await pdfFile.arrayBuffer();
            const pdfDoc = await PDFLib.PDFDocument.load(pdfBytes);

            // Create a new PDF document to copy pages, applying different settings
            const newPdfDoc = await PDFLib.PDFDocument.create();

            for (let i = 0; i < pdfDoc.getPageCount(); i++) {
                const [copiedPage] = await newPdfDoc.copyPages(pdfDoc, [i]);
                newPdfDoc.addPage(copiedPage);
            }

            // This part is tricky for client-side compression. pdf-lib allows control
            // over embedding options (e.g., image quality). True "compression" means
            // re-encoding streams, removing metadata, etc., which is complex.
            // Saving with different encoder options can reduce size.
            let savedPdfBytes;
            if (compressionLevel === 'low') {
                savedPdfBytes = await newPdfDoc.save({
                    use='https://unpkg.com/@ffmpeg/ffmpeg@0.9.7/dist/ffmpeg.min.js'
                    data-wasm-path='https://unpkg.com/@ffmpeg/core@0.8.5/dist/ffmpeg-core.wasm'
                    data-worker-path='https://unpkg.com/@ffmpeg/core@0.8.5/dist/ffmpeg-worker.js'
                    
                    // You might need to adjust this depending on how you structure FFmpeg.js for production
                    // For local development, this assumes the files are served from the same origin or a compatible CDN.
                    // If you face issues, consider hosting ffmpeg-core.wasm and ffmpeg-worker.js yourself.
                };
            }
            if (!ffmpeg.isLoaded()) {
                await ffmpeg.load();
            }
            ffmpeg.FS('writeFile', videoFile.name, await fetchFile(videoFile));

            const outputPath = `compressed_${videoFile.name.split('.')[0]}.mp4`;
            const command = [
                '-i', videoFile.name,
                '-vf', `scale=${targetResolution}`,
                '-b:v', `${bitrate}M`,
                '-c:v', 'libx264', // Specify H.264 codec
                '-preset', 'medium', // Encoding speed vs compression ratio
                '-crf', '28', // Constant Rate Factor (lower is better quality, larger file)
                outputPath
            ];

            // Show a specific message while FFmpeg processes
            loadingMessage.textContent = `Compressing video... (This can take a while for large files)`;

            ffmpeg.setProgress(({ ratio }) => {
                if (ratio < 1) {
                    loadingMessage.textContent = `Compressing video: ${(ratio * 100).toFixed(0)}%`;
                }
            });

            await ffmpeg.run(...command);
            const data = ffmpeg.FS('readFile', outputPath);
            const compressedBlob = new Blob([data.buffer], { type: 'video/mp4' });

            const originalVideoURL = URL.createObjectURL(videoFile);
            const compressedVideoURL = URL.createObjectURL(compressedBlob);

            document.getElementById('original-video-preview').src = originalVideoURL;
            document.getElementById('original-video-preview').classList.remove('hidden');
            document.getElementById('compressed-video-preview').src = compressedVideoURL;
            document.getElementById('compressed-video-preview').classList.remove('hidden');
            document.getElementById('video-compressor-placeholder').classList.add('hidden');


            processedResults['video-compressor'] = [compressedBlob];
            const downloadContainer = document.getElementById('download-buttons-video-compressor');
            downloadContainer.innerHTML = '';
            addDownloadButton(downloadContainer.id, compressedBlob, outputPath);

            document.getElementById('video-compressor-results').classList.remove('hidden');

        } catch (error) {
            console.error('Video compression failed:', error);
            alert('Video compression failed: ' + error.message + '\nCheck console for details.');
        } finally {
            hideLoading();
            ffmpeg.exit(); // Clean up FFmpeg worker
        }
    });

    // --- Video Converter ---
    setupFileInput('video-converter-tool', 'video-converter-file-input', 'video-converter-drop-area');
    const videoOutputFormatSelect = document.getElementById('video-output-format');

    document.getElementById('convert-video-button').addEventListener('click', async () => {
        const files = selectedFiles['video-converter-tool'];
        if (files.length === 0) {
            alert('Please select a video to convert.');
            return;
        }
        showLoading('Converting video...');
        const videoFile = files[0];
        const outputFormat = videoOutputFormatSelect.value;
        const outputFilename = `${videoFile.name.split('.')[0]}.${outputFormat}`;

        try {
            if (!ffmpeg.isLoaded()) {
                await ffmpeg.load();
            }
            ffmpeg.FS('writeFile', videoFile.name, await fetchFile(videoFile));

            const command = [
                '-i', videoFile.name,
                outputFilename
            ];

            loadingMessage.textContent = `Converting video... (This can take a while)`;
            ffmpeg.setProgress(({ ratio }) => {
                if (ratio < 1) {
                    loadingMessage.textContent = `Converting video: ${(ratio * 100).toFixed(0)}%`;
                }
            });

            await ffmpeg.run(...command);
            const data = ffmpeg.FS('readFile', outputFilename);
            const convertedBlob = new Blob([data.buffer], { type: `video/${outputFormat}` });

            const originalVideoURL = URL.createObjectURL(videoFile);
            const convertedVideoURL = URL.createObjectURL(convertedBlob);

            document.getElementById('converter-original-video-preview').src = originalVideoURL;
            document.getElementById('converter-original-video-preview').classList.remove('hidden');
            document.getElementById('converted-video-preview').src = convertedVideoURL;
            document.getElementById('converted-video-preview').classList.remove('hidden');
            document.getElementById('video-converter-placeholder').classList.add('hidden');


            processedResults['video-converter-tool'] = [convertedBlob];
            const downloadContainer = document.getElementById('download-buttons-video-converter');
            downloadContainer.innerHTML = '';
            addDownloadButton(downloadContainer.id, convertedBlob, outputFilename);

            document.getElementById('video-converter-results').classList.remove('hidden');

        } catch (error) {
            console.error('Video conversion failed:', error);
            alert('Video conversion failed: ' + error.message + '\nCheck console for details.');
        } finally {
            hideLoading();
            ffmpeg.exit();
        }
    });

    // --- Video Trimmer ---
    setupFileInput('video-trimmer-tool', 'video-trimmer-file-input', 'video-trimmer-drop-area');
    const trimStartTimeInput = document.getElementById('trim-start-time');
    const trimEndTimeInput = document.getElementById('trim-end-time');

    document.getElementById('trim-video-button').addEventListener('click', async () => {
        const files = selectedFiles['video-trimmer-tool'];
        if (files.length === 0) {
            alert('Please select a video to trim.');
            return;
        }
        showLoading('Trimming video...');
        const videoFile = files[0];
        const startTime = parseFloat(trimStartTimeInput.value);
        const endTime = parseFloat(trimEndTimeInput.value);

        if (isNaN(startTime) || isNaN(endTime) || startTime < 0 || endTime <= startTime) {
            alert('Please enter valid start and end times.');
            hideLoading();
            return;
        }

        try {
            if (!ffmpeg.isLoaded()) {
                await ffmpeg.load();
            }
            ffmpeg.FS('writeFile', videoFile.name, await fetchFile(videoFile));

            const outputFilename = `trimmed_${videoFile.name.split('.')[0]}.mp4`;
            const command = [
                '-i', videoFile.name,
                '-ss', `${startTime}`,
                '-to', `${endTime}`,
                '-c', 'copy', // Fast copy (no re-encoding) - might cause issues with keyframes
                // For more robust trimming with re-encoding:
                // '-c:v', 'libx264', '-crf', '23', '-preset', 'fast', '-c:a', 'aac',
                outputFilename
            ];

            loadingMessage.textContent = `Trimming video... (This can take a while if re-encoding)`;
            ffmpeg.setProgress(({ ratio }) => {
                if (ratio < 1) {
                    loadingMessage.textContent = `Trimming video: ${(ratio * 100).toFixed(0)}%`;
                }
            });

            await ffmpeg.run(...command);
            const data = ffmpeg.FS('readFile', outputFilename);
            const trimmedBlob = new Blob([data.buffer], { type: 'video/mp4' });

            const originalVideoURL = URL.createObjectURL(videoFile);
            const trimmedVideoURL = URL.createObjectURL(trimmedBlob);

            document.getElementById('trimmer-original-video-preview').src = originalVideoURL;
            document.getElementById('trimmer-original-video-preview').classList.remove('hidden');
            document.getElementById('trimmed-video-preview').src = trimmedVideoURL;
            document.getElementById('trimmed-video-preview').classList.remove('hidden');
            document.getElementById('video-trimmer-placeholder').classList.add('hidden');


            processedResults['video-trimmer-tool'] = [trimmedBlob];
            const downloadContainer = document.getElementById('download-buttons-video-trimmer');
            downloadContainer.innerHTML = '';
            addDownloadButton(downloadContainer.id, trimmedBlob, outputFilename);

            document.getElementById('video-trimmer-results').classList.remove('hidden');

        } catch (error) {
            console.error('Video trimming failed:', error);
            alert('Video trimming failed: ' + error.message + '\nNote: Fast trimming might fail on certain video types. Try re-encoding if issues persist.');
        } finally {
            hideLoading();
            ffmpeg.exit();
        }
    });

}); // DOMContentLoaded end
