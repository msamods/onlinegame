import Phaser from 'phaser';
import { SpriteGenerator } from '../assets/SpriteGenerator';

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  create(): void {
    // Generate all procedural cartoon military sprites and tiles
    SpriteGenerator.generateAllTextures(this);

    // Launch GameScene
    this.scene.start('GameScene');
  }
}

