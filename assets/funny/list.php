<?php
// Directory where your funny pics are stored
$dir = __DIR__;

// Find all supported image types
$files = array_values(array_filter(scandir($dir), function($f) use ($dir) {
    return is_file($dir . DIRECTORY_SEPARATOR . $f)
        && preg_match('/\.(jpe?g|png|gif|webp)$/i', $f);
}));

// Return JSON
header('Content-Type: application/json; charset=utf-8');
echo json_encode($files);
