import Foundation
import CoreImage
import ImageIO
import UniformTypeIdentifiers
import CryptoKit

// Optical perspective correction from original pixels. No painting, relighting or text replacement.
guard CommandLine.arguments.count == 4 else { fatalError("Usage: swift render-capture-sleeves.swift ORIGINALS CROP_CALIBRATION OUTPUT_DIRECTORY") }
let originals = URL(fileURLWithPath: CommandLine.arguments[1], isDirectory: true)
let calibrationURL = URL(fileURLWithPath: CommandLine.arguments[2])
let output = URL(fileURLWithPath: CommandLine.arguments[3], isDirectory: true)
try FileManager.default.createDirectory(at: output, withIntermediateDirectories: true)
let calibration = try JSONSerialization.jsonObject(with: Data(contentsOf: calibrationURL)) as! [String: Any]
let entries = calibration["files"] as! [[String: Any]]
let context = CIContext(options: [.cacheIntermediates: false])
let colorSpace = CGColorSpace(name: CGColorSpace.sRGB)!
var results: [[String: Any]] = []
for entry in entries {
  try autoreleasepool {
    let name = entry["filename"] as! String
    guard entry["reviewed"] as? Bool == true else { fatalError("Unreviewed crop: \(name)") }
    let sourceURL = originals.appendingPathComponent(name)
    guard let source = CGImageSourceCreateWithURL(sourceURL as CFURL, nil),
      let cgImage = CGImageSourceCreateImageAtIndex(source, 0, nil),
      let properties = CGImageSourceCopyPropertiesAtIndex(source, 0, nil) as? [String: Any] else { fatalError("Cannot decode \(name)") }
    let orientation = (properties[kCGImagePropertyOrientation as String] as? NSNumber)?.int32Value ?? 1
    var image = CIImage(cgImage: cgImage).oriented(forExifOrientation: orientation)
    image = image.transformed(by: CGAffineTransform(translationX: -image.extent.minX, y: -image.extent.minY))
    let corners = entry["corners"] as! [[Double]]
    func corner(_ index: Int) -> CIVector { CIVector(x: corners[index][0] * image.extent.width, y: (1-corners[index][1]) * image.extent.height) }
    guard let filter = CIFilter(name: "CIPerspectiveCorrection", parameters: [
      kCIInputImageKey: image, "inputTopLeft": corner(0), "inputTopRight": corner(1),
      "inputBottomRight": corner(2), "inputBottomLeft": corner(3)
    ]), var corrected = filter.outputImage else { fatalError("Cannot rectify \(name)") }
    corrected = corrected.transformed(by: CGAffineTransform(translationX: -corrected.extent.minX, y: -corrected.extent.minY))
    let rotation = entry["clockwiseRotation"] as? Int ?? 0
    let exifRotation: Int32 = rotation == 90 ? 6 : rotation == 180 ? 3 : rotation == 270 ? 8 : 1
    corrected = corrected.oriented(forExifOrientation: exifRotation)
    corrected = corrected.transformed(by: CGAffineTransform(translationX: -corrected.extent.minX, y: -corrected.extent.minY))
    let side = 2200.0
    corrected = corrected.transformed(by: CGAffineTransform(scaleX: side/corrected.extent.width, y: side/corrected.extent.height))
    guard let result = context.createCGImage(corrected, from: CGRect(x: 0, y: 0, width: side, height: side), format: .RGBA8, colorSpace: colorSpace) else { fatalError("Cannot render \(name)") }
    let assetName = sourceURL.deletingPathExtension().lastPathComponent + "-sleeve.jpg"
    let assetURL = output.appendingPathComponent(assetName)
    guard let destination = CGImageDestinationCreateWithURL(assetURL as CFURL, UTType.jpeg.identifier as CFString, 1, nil) else { fatalError("Cannot save \(name)") }
    CGImageDestinationAddImage(destination, result, [kCGImageDestinationLossyCompressionQuality: 0.94] as CFDictionary)
    guard CGImageDestinationFinalize(destination) else { fatalError("Cannot finish \(name)") }
    let originalData = try Data(contentsOf: sourceURL)
    let assetData = try Data(contentsOf: assetURL)
    results.append(["filename": name, "asset": assetName, "width": Int(side), "height": Int(side),
      "originalSha256": SHA256.hash(data: originalData).map { String(format: "%02x", $0) }.joined(),
      "assetSha256": SHA256.hash(data: assetData).map { String(format: "%02x", $0) }.joined(),
      "corners": corners, "clockwiseRotation": rotation, "sourceExifOrientation": orientation,
      "processing": "Original HEIC decoded with EXIF orientation; reviewed outer-jacket quadrilateral optically rectified, rotated upright, converted to sRGB and exported at 2200px. Capture metadata omitted. Printed artwork, wear and lighting retained."])
    print("Rendered \(name)")
    fflush(stdout)
  }
}
try JSONSerialization.data(withJSONObject: ["files": results], options: [.prettyPrinted, .sortedKeys]).write(to: calibrationURL.deletingLastPathComponent().appendingPathComponent("rendered-assets.json"))
