import Phaser from 'phaser';
import titleUrl from '../../assets/title.jpg';
import { makeTextures } from '../textures';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('boot');
  }

  preload(): void {
    this.load.image('title', titleUrl);
  }

  create(): void {
    makeTextures(this);
    this.scene.start('title');
  }
}
