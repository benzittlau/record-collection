import Foundation
import Vision
import ImageIO

// Candidate sleeve corners only; every selected crop is visually reviewed.
guard CommandLine.arguments.count == 2 else { fatalError("Usage: swift locate-capture-sleeves.swift INTAKE_INSPECTION_DIRECTORY") }
let root = URL(fileURLWithPath: CommandLine.arguments[1], isDirectory: true)
let paths = try FileManager.default.contentsOfDirectory(at: root.appendingPathComponent("previews"), includingPropertiesForKeys: nil)
  .filter { $0.pathExtension == "jpg" }.sorted { $0.lastPathComponent < $1.lastPathComponent }
for file in paths {
  try autoreleasepool {
    let source = CGImageSourceCreateWithURL(file as CFURL, nil)!
    let image = CGImageSourceCreateImageAtIndex(source, 0, nil)!
    let request = VNDetectDocumentSegmentationRequest()
    try VNImageRequestHandler(cgImage: image).perform([request])
    let metadataURL = root.appendingPathComponent(file.deletingPathExtension().lastPathComponent + ".json")
    var entry = try JSONSerialization.jsonObject(with: Data(contentsOf: metadataURL)) as! [String: Any]
    func point(_ p: CGPoint) -> [Double] { [Double(p.x), Double(p.y)] }
    entry["documentRectangles"] = (request.results ?? []).map { item in [
      "confidence": item.confidence, "topLeft": point(item.topLeft), "topRight": point(item.topRight),
      "bottomLeft": point(item.bottomLeft), "bottomRight": point(item.bottomRight)
    ] as [String: Any] }
    try JSONSerialization.data(withJSONObject: entry, options: [.prettyPrinted, .sortedKeys]).write(to: metadataURL)
  }
}
print("Document-corner candidates recorded for \(paths.count) photographs.")
