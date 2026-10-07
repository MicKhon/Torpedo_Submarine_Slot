import AppKit
import SpriteKit

/// SpriteKit layer for the torpedo run, mine blast, and win burst.
/// SpriteKit is the Mac-native 2D engine: actions, emitters, and screen shake without a third-party runtime.
final class SeaFXScene: SKScene {
    private let world = SKNode()
    private var torpedo: SKNode?
    private var trail: SKEmitterNode?
    private var dot: SKTexture?

    override init(size: CGSize) {
        super.init(size: size)
        scaleMode = .resizeFill
        backgroundColor = .clear
        anchorPoint = .zero
        addChild(world)
    }

    required init?(coder aDecoder: NSCoder) {
        fatalError("init(coder:) is not used")
    }

    override func didMove(to view: SKView) {
        view.allowsTransparency = true
        view.ignoresSiblingOrder = true
    }

    func aimTorpedo() {
        clearTorpedo()
        let node = makeTorpedo()
        let y = size.height * 0.62
        node.position = CGPoint(x: -30, y: y)
        node.zPosition = 8
        world.addChild(node)
        torpedo = node
        let travel = SKAction.moveTo(x: max(size.width * 0.72, 200), duration: 0.8)
        travel.timingMode = .easeIn
        node.run(travel)
        bubbles(around: node, rate: 90, speed: 70)
    }

    func resolveTorpedo(hit: Bool) {
        guard let torpedo else { return }
        torpedo.removeAllActions()
        if hit {
            explode(at: torpedo.position, color: SKColor(red: 1, green: 0.55, blue: 0.2, alpha: 1), scale: 1.3)
            shake(amount: 14)
            flash(SKColor(red: 1, green: 0.8, blue: 0.45, alpha: 1), alpha: 0.45)
            torpedo.run(.sequence([.fadeOut(withDuration: 0.12), .removeFromParent()]))
        } else {
            let sink = SKAction.group([
                .moveBy(x: 80, y: -size.height * 0.35, duration: 0.45),
                .rotate(byAngle: -0.6, duration: 0.45),
                .fadeOut(withDuration: 0.45)
            ])
            torpedo.run(.sequence([sink, .removeFromParent()]))
        }
        self.torpedo = nil
    }

    func launchTorpedo() {
        clearTorpedo()
        let node = makeTorpedo()
        let y = size.height * 0.42
        node.position = CGPoint(x: 24, y: y)
        node.setScale(1.35)
        node.zPosition = 10
        world.addChild(node)
        torpedo = node
        bubbles(around: node, rate: 140, speed: 120)
        let travel = SKAction.moveTo(x: size.width + 80, duration: 0.95)
        travel.timingMode = .easeIn
        node.run(.sequence([
            travel,
            .run { [weak self] in
                guard let self else { return }
                self.explode(at: CGPoint(x: self.size.width * 0.82, y: y), color: SKColor(red: 1, green: 0.42, blue: 0.15, alpha: 1), scale: 1.8)
                self.shake(amount: 18)
                self.flash(.white, alpha: 0.55)
            },
            .removeFromParent()
        ]))
    }

    func blast() {
        let origin = CGPoint(x: size.width * 0.5, y: size.height * 0.55)
        explode(at: origin, color: SKColor(red: 1, green: 0.35, blue: 0.12, alpha: 1), scale: 1.1)
        shake(amount: 8)
        flash(SKColor(red: 1, green: 0.45, blue: 0.2, alpha: 1), alpha: 0.28)
    }

    func celebrate(big: Bool) {
        let origin = CGPoint(x: size.width * 0.5, y: size.height * 0.38)
        let emitter = emitter(rate: big ? 220 : 90, life: big ? 1.6 : 1.0, speed: big ? 280 : 160)
        emitter.particleColor = SKColor(red: 0.93, green: 0.75, blue: 0.32, alpha: 1)
        emitter.particleScale = big ? 0.55 : 0.35
        emitter.particleScaleRange = 0.25
        emitter.emissionAngle = .pi / 2
        emitter.emissionAngleRange = .pi / 1.4
        emitter.yAcceleration = -220
        emitter.position = origin
        emitter.zPosition = 12
        world.addChild(emitter)
        emitter.run(.sequence([
            .wait(forDuration: 0.25),
            .run { emitter.particleBirthRate = 0 },
            .wait(forDuration: 1.8),
            .removeFromParent()
        ]))
        if big {
            shake(amount: 10)
            flash(SKColor(red: 1, green: 0.86, blue: 0.45, alpha: 1), alpha: 0.33)
            ring(at: origin, color: SKColor(red: 0.93, green: 0.75, blue: 0.32, alpha: 1), radius: 30, end: 280)
        }
    }

    private func clearTorpedo() {
        torpedo?.removeFromParent()
        torpedo = nil
        trail?.removeFromParent()
        trail = nil
    }

    private func makeTorpedo() -> SKNode {
        let root = SKNode()
        let body = SKShapeNode(rectOf: CGSize(width: 108, height: 18), cornerRadius: 8)
        body.fillColor = SKColor(red: 0.78, green: 0.64, blue: 0.30, alpha: 1)
        body.strokeColor = SKColor(white: 1, alpha: 0.35)
        body.lineWidth = 1
        body.glowWidth = 2
        let nose = SKShapeNode()
        let path = CGMutablePath()
        path.move(to: CGPoint(x: 0, y: 9))
        path.addLine(to: CGPoint(x: 28, y: 0))
        path.addLine(to: CGPoint(x: 0, y: -9))
        path.closeSubpath()
        nose.path = path
        nose.fillColor = SKColor(red: 0.82, green: 0.18, blue: 0.16, alpha: 1)
        nose.strokeColor = .clear
        nose.position = CGPoint(x: 54, y: 0)
        let fin = SKShapeNode()
        let fins = CGMutablePath()
        fins.move(to: CGPoint(x: -46, y: 6))
        fins.addLine(to: CGPoint(x: -62, y: 16))
        fins.addLine(to: CGPoint(x: -40, y: 6))
        fins.move(to: CGPoint(x: -46, y: -6))
        fins.addLine(to: CGPoint(x: -62, y: -16))
        fins.addLine(to: CGPoint(x: -40, y: -6))
        fin.path = fins
        fin.strokeColor = SKColor(red: 0.55, green: 0.42, blue: 0.16, alpha: 1)
        fin.lineWidth = 3
        root.addChild(body)
        root.addChild(nose)
        root.addChild(fin)
        return root
    }

    private func bubbles(around node: SKNode, rate: CGFloat, speed: CGFloat) {
        let emitter = emitter(rate: rate, life: 0.9, speed: speed)
        emitter.particleColor = SKColor(white: 1, alpha: 1)
        emitter.particleAlpha = 0.45
        emitter.particleScale = 0.28
        emitter.particleScaleRange = 0.15
        emitter.emissionAngle = .pi
        emitter.emissionAngleRange = 0.4
        emitter.targetNode = world
        node.addChild(emitter)
        trail = emitter
    }

    private func explode(at point: CGPoint, color: SKColor, scale: CGFloat) {
        let fire = emitter(rate: 600, life: 0.7, speed: 220 * scale)
        fire.particleColor = color
        fire.particleScale = 0.7 * scale
        fire.particleScaleSpeed = -0.6
        fire.emissionAngleRange = .pi * 2
        fire.particleAlphaSpeed = -1.2
        fire.position = point
        fire.zPosition = 14
        fire.numParticlesToEmit = Int(70 * scale)
        world.addChild(fire)
        fire.run(.sequence([.wait(forDuration: 1.2), .removeFromParent()]))
        ring(at: point, color: color, radius: 18, end: 160 * scale)
        ring(at: point, color: .white, radius: 8, end: 90 * scale)
    }

    private func ring(at point: CGPoint, color: SKColor, radius: CGFloat, end: CGFloat) {
        let ring = SKShapeNode(circleOfRadius: radius)
        ring.strokeColor = color
        ring.fillColor = .clear
        ring.lineWidth = 3
        ring.glowWidth = 4
        ring.position = point
        ring.alpha = 0.9
        ring.zPosition = 13
        world.addChild(ring)
        let grow = end / radius
        ring.run(.sequence([
            .group([
                .scale(to: grow, duration: 0.45),
                .fadeOut(withDuration: 0.45)
            ]),
            .removeFromParent()
        ]))
    }

    private func shake(amount: CGFloat) {
        world.removeAction(forKey: "shake")
        let step = SKAction.sequence([
            .moveBy(x: amount, y: -amount * 0.4, duration: 0.03),
            .moveBy(x: -amount * 1.4, y: amount * 0.7, duration: 0.03),
            .moveBy(x: amount * 0.8, y: -amount * 0.3, duration: 0.03),
            .move(to: .zero, duration: 0.04)
        ])
        world.run(.repeat(step, count: 3), withKey: "shake")
    }

    private func flash(_ color: SKColor, alpha: CGFloat) {
        let veil = SKSpriteNode(color: color, size: CGSize(width: max(size.width, 1), height: max(size.height, 1)))
        veil.position = CGPoint(x: size.width / 2, y: size.height / 2)
        veil.alpha = 0
        veil.zPosition = 20
        world.addChild(veil)
        veil.run(.sequence([
            .fadeAlpha(to: alpha, duration: 0.04),
            .fadeOut(withDuration: 0.28),
            .removeFromParent()
        ]))
    }

    private func emitter(rate: CGFloat, life: CGFloat, speed: CGFloat) -> SKEmitterNode {
        let node = SKEmitterNode()
        node.particleTexture = dotTexture()
        node.particleBirthRate = rate
        node.particleLifetime = life
        node.particleSpeed = speed
        node.particleSpeedRange = speed * 0.45
        node.particleColorBlendFactor = 1
        node.particleAlpha = 0.9
        return node
    }

    private func dotTexture() -> SKTexture {
        if let dot { return dot }
        let image = NSImage(size: NSSize(width: 16, height: 16), flipped: false) { rect in
            NSColor.white.setFill()
            NSBezierPath(ovalIn: rect.insetBy(dx: 1, dy: 1)).fill()
            return true
        }
        let texture = SKTexture(image: image)
        dot = texture
        return texture
    }
}
