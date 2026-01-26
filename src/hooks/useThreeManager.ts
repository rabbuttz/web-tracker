import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { makeHandGizmo } from '../utils/trackingUtils';
import { WIDTH, HEIGHT } from '../constants';

export function useThreeManager(canvas: HTMLCanvasElement | null) {
    const stateRef = useRef<{
        renderer: THREE.WebGLRenderer;
        scene: THREE.Scene;
        camera: THREE.OrthographicCamera;
        handGizmos: THREE.Object3D[];
        faceGizmo: THREE.Object3D;
    } | null>(null);

    useEffect(() => {
        if (!canvas) return;

        const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
        renderer.setSize(WIDTH, HEIGHT, false);
        renderer.setPixelRatio(window.devicePixelRatio);

        const scene = new THREE.Scene();
        const camera = new THREE.OrthographicCamera(0, WIDTH, HEIGHT, 0, -1000, 1000);
        camera.position.z = 10;

        const handGizmos = [makeHandGizmo(60), makeHandGizmo(60)];
        handGizmos.forEach((g) => {
            g.visible = false;
            scene.add(g);
        });

        const faceGizmo = makeHandGizmo(80);
        faceGizmo.visible = false;
        scene.add(faceGizmo);

        stateRef.current = { renderer, scene, camera, handGizmos, faceGizmo };

        let raf = 0;
        const tick = () => {
            raf = requestAnimationFrame(tick);
            renderer.render(scene, camera);
        };
        tick();

        return () => {
            cancelAnimationFrame(raf);
            renderer.dispose();
            stateRef.current = null;
        };
    }, [canvas]);

    return stateRef;
}
