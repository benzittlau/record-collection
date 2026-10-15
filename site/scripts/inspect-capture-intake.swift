import Foundation
import ImageIO
import Vision
import UniformTypeIdentifiers
import CryptoKit

// Read-only inspection of original phone files. Previews omit capture metadata.
let arguments = CommandLine.arguments
guard arguments.count == 3 else { fatalError("Usage: swift inspect-capture-intake.swift INPUT_DIRECTORY OUTPUT_DIRECTORY") }
let input = URL(fileURLWithPath: arguments[1], isDirectory: true)
let output = URL(fileURLWithPath: arguments[2], isDirectory: true)
let manager = FileManager.default
try manager.createDirectory(at: output.appendingPathComponent("previews"), withIntermediateDirectories: true)
let files = try manager.contentsOfDirectory(at: input, includingPropertiesForKeys: nil)
  .filter { ["heic", "heif", "jpg", "jpeg", "png"].contains($0.pathExtension.lowercased()) }
  .sorted { $0.lastPathComponent.localizedStandardCompare($1.lastPathComponent) == .orderedAscending }
var inventory: [[String: Any]] = []
for (index, file) in files.enumerated() {
  try autoreleasepool {
    let data = try Data(contentsOf: file)
    guard let source = CGImageSourceCreateWithData(data as CFData, nil),
      let properties = CGImageSourceCopyPropertiesAtIndex(source, 0, nil) as? [String: Any],
      let image = CGImageSourceCreateThumbnailAtIndex(source, 0, [
        kCGImageSourceCreateThumbnailFromImageAlways: true,
        kCGImageSourceCreateThumbnailWithTransform: true,
        kCGImageSourceThumbnailMaxPixelSize: 2400
      ] as CFDictionary) else { fatalError("Cannot decode \(file.lastPathComponent)") }
    let preview = file.deletingPathExtension().lastPathComponent + ".jpg"
    let destinationURL = output.appendingPathComponent("previews").appendingPathComponent(preview)
    guard let destination = CGImageDestinationCreateWithURL(destinationURL as CFURL, UTType.jpeg.identifier as CFString, 1, nil) else { fatalError("Cannot create preview") }
    CGImageDestinationAddImage(destination, image, [kCGImageDestinationLossyCompressionQuality: 0.9] as CFDictionary)
    guard CGImageDestinationFinalize(destination) else { fatalError("Cannot finish preview") }
    var entry: [String: Any] = [
      "sequence": index + 1, "filename": file.lastPathComponent, "preview": "previews/" + preview,
      "sha256": SHA256.hash(data: data).map { String(format: "%02x", $0) }.joined(),
      "bytes": data.count, "originalWidth": properties[kCGImagePropertyPixelWidth as String] ?? 0,
      "originalHeight": properties[kCGImagePropertyPixelHeight as String] ?? 0,
      "originalOrientation": properties[kCGImagePropertyOrientation as String] ?? 1,
      "previewWidth": image.width, "previewHeight": image.height
    ]
    if let exif = properties[kCGImagePropertyExifDictionary as String] as? [String: Any] {
      entry["capturedAt"] = exif[kCGImagePropertyExifDateTimeOriginal as String]
      entry["capturedAtSubsecond"] = exif[kCGImagePropertyExifSubsecTimeOriginal as String]
    }
    let ocr = VNRecognizeTextRequest()
    ocr.recognitionLevel = .accurate
    ocr.usesLanguageCorrection = false
    let rectangles = VNDetectRectanglesRequest()
    rectangles.maximumObservations = 8
    rectangles.minimumConfidence = 0.4
    rectangles.minimumSize = 0.2
    rectangles.minimumAspectRatio = 0.5
    rectangles.quadratureTolerance = 35
    try VNImageRequestHandler(cgImage: image).perform([ocr, rectangles])
    entry["text"] = (ocr.results ?? []).compactMap { item -> [String: Any]? in
      guard let candidate = item.topCandidates(1).first else { return nil }
      return ["text": candidate.string, "confidence": candidate.confidence,
        "bounds": [item.boundingBox.minX, item.boundingBox.minY, item.boundingBox.width, item.boundingBox.height]]
    }
    func point(_ p: CGPoint) -> [Double] { [Double(p.x), Double(p.y)] }
    entry["rectangles"] = (rectangles.results ?? []).map { item in [
      "confidence": item.confidence, "topLeft": point(item.topLeft), "topRight": point(item.topRight),
      "bottomLeft": point(item.bottomLeft), "bottomRight": point(item.bottomRight)
    ] as [String: Any] }
    let entryData = try JSONSerialization.data(withJSONObject: entry, options: [.prettyPrinted, .sortedKeys])
    try entryData.write(to: output.appendingPathComponent(file.deletingPathExtension().lastPathComponent + ".json"))
    inventory.append(entry)
    print("\(index + 1)/\(files.count) \(file.lastPathComponent)")
    fflush(stdout)
  }
}
let result = try JSONSerialization.data(withJSONObject: ["files": inventory], options: [.prettyPrinted, .sortedKeys])
try result.write(to: output.appendingPathComponent("inventory.json"))
