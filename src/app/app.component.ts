import { Component, OnInit } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { FormsModule } from '@angular/forms'; // Importar FormsModule para [(ngModel)]

// Importaciones de Angular Material
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatChipsModule } from '@angular/material/chips'; // Para MatChipListbox y MatChipOption
import { MatSnackBarModule, MatSnackBar } from '@angular/material/snack-bar'; // Correcta importación del módulo y el servicio

import { BlockchainService } from './services/blockchain.service';
import { Observable } from 'rxjs';

interface StudentIdentity {
    name: string;
    studentIDHash: string;
    isValidated: boolean;
    validatorAddress: string;
    registeredAt: number;
}

@Component({
    selector: 'app-root',
    standalone: true,
    imports: [
        CommonModule,
        RouterOutlet,
        FormsModule, // Necesario para [(ngModel)]
        DatePipe, // Necesario para el pipe 'date' en el HTML
        // Módulos de Angular Material
        MatToolbarModule,
        MatButtonModule,
        MatCardModule,
        MatFormFieldModule,
        MatInputModule,
        MatChipsModule,
        MatSnackBarModule // El módulo para el servicio MatSnackBar
    ],
    templateUrl: './app.component.html',
    styleUrls: ['./app.component.scss'] // La ruta correcta del SCSS
})
export class AppComponent implements OnInit {
    title = 'EduChain Verify';

    currentAccount: string | null = null;
    isConnected: boolean = false;
    isValidator: boolean = false;

    studentName: string = '';
    studentIDHash: string = '';
    registrationTxHash: string | null = null;

    studentAddressToValidate: string = '';
    validationTxHash: string | null = null;

    studentAddressToVerify: string = '';
    verifiedIdentity: StudentIdentity | null = null;

    newValidatorAddress: string = '';
    addValidatorTxHash: string | null = null;

    constructor(
        private blockchainService: BlockchainService,
        private snackBar: MatSnackBar // Inyectar el servicio MatSnackBar
    ) {}

    ngOnInit(): void {
        this.blockchainService.currentAccount$.subscribe(account => {
            this.currentAccount = account;
        });

        this.blockchainService.isConnected$.subscribe(connected => {
            this.isConnected = connected;
            if (connected) {
                this.checkIfValidator();
            } else {
                this.isValidator = false;
            }
        });
    }

    connectWallet(): void {
        this.blockchainService.connectWallet().subscribe({
            next: (account) => {
                if (account) {
                    this.snackBar.open('Wallet conectada exitosamente!', 'Cerrar', { duration: 3000 });
                } else {
                    this.snackBar.open('Fallo al conectar la wallet.', 'Cerrar', { duration: 3000 });
                }
            },
            error: (err) => {
                console.error("Error al conectar wallet:", err);
                this.snackBar.open(`Error: ${err.message || err}`, 'Cerrar', { duration: 5000 });
            }
        });
    }

    checkIfValidator(): void {
        this.blockchainService.isCurrentAccountValidator().subscribe({
            next: (isVal) => {
                this.isValidator = isVal;
                if (isVal) {
                    this.snackBar.open('Esta cuenta es un validador.', 'Cerrar', { duration: 3000 });
                } else {
                    this.snackBar.open('Esta cuenta NO es un validador.', 'Cerrar', { duration: 3000 });
                }
            },
            error: (err) => {
                console.error("Error al verificar si es validador:", err);
                this.snackBar.open(`Error al verificar validador: ${err.message || err}`, 'Cerrar', { duration: 5000 });
            }
        });
    }

    registerIdentity(): void {
        if (!this.studentName || !this.studentIDHash) {
            this.snackBar.open('Por favor, ingresa el nombre y el hash de ID.', 'Cerrar', { duration: 3000 });
            return;
        }

        this.blockchainService.registerStudentIdentity(this.studentName, this.studentIDHash).subscribe({
            next: (txHash) => {
                this.registrationTxHash = txHash;
                this.snackBar.open('Identidad registrada! TX: ' + txHash.slice(0, 10) + '...', 'Cerrar', { duration: 5000 });
                this.studentName = '';
                this.studentIDHash = '';
            },
            error: (err) => {
                console.error("Error al registrar identidad:", err);
                this.snackBar.open(`Error al registrar: ${err.message || err}`, 'Cerrar', { duration: 5000 });
            }
        });
    }

    validateIdentity(): void {
        if (!this.studentAddressToValidate) {
            this.snackBar.open('Por favor, ingresa la dirección del estudiante a validar.', 'Cerrar', { duration: 3000 });
            return;
        }
        if (!this.isValidator) {
            this.snackBar.open('Solo las cuentas validadoras pueden validar identidades.', 'Cerrar', { duration: 3000 });
            return;
        }

        this.blockchainService.validateIdentity(this.studentAddressToValidate).subscribe({
            next: (txHash) => {
                this.validationTxHash = txHash;
                this.snackBar.open('Identidad validada! TX: ' + txHash.slice(0, 10) + '...', 'Cerrar', { duration: 5000 });
                this.studentAddressToValidate = '';
            },
            error: (err) => {
                console.error("Error al validar identidad:", err);
                this.snackBar.open(`Error al validar: ${err.message || err}`, 'Cerrar', { duration: 5000 });
            }
        });
    }

    verifyIdentity(): void {
        if (!this.studentAddressToVerify) {
            this.snackBar.open('Por favor, ingresa la dirección del estudiante a verificar.', 'Cerrar', { duration: 3000 });
            return;
        }
        // Validación de formato de dirección antes de llamar al servicio
        if (!this.studentAddressToVerify.startsWith('0x') || this.studentAddressToVerify.length !== 42) {
             this.snackBar.open('Por favor, introduce una dirección Ethereum válida (ej. 0x...).', 'Cerrar', { duration: 4000 });
             this.verifiedIdentity = null;
             return;
        }


        this.verifiedIdentity = null;

        this.blockchainService.getStudentIdentity(this.studentAddressToVerify).subscribe({
            next: (identity) => {
                if (identity.name === '' && identity.studentIDHash === '' && identity.registeredAt === 0) { // Añadir registeredAt === 0 para mejor verificación de vacío
                    this.snackBar.open('No se encontró una identidad para esta dirección.', 'Cerrar', { duration: 3000 });
                    this.verifiedIdentity = null;
                } else {
                    this.verifiedIdentity = identity;
                    this.snackBar.open('Identidad verificada exitosamente!', 'Cerrar', { duration: 3000 });
                }
            },
            error: (err) => {
                console.error("Error al verificar identidad:", err);
                this.snackBar.open(`Error al verificar: ${err.message || err}`, 'Cerrar', { duration: 5000 });
                this.verifiedIdentity = null;
            }
        });
    }

    addValidator(): void {
        if (!this.newValidatorAddress) {
            this.snackBar.open('Por favor, ingresa la dirección del nuevo validador.', 'Cerrar', { duration: 3000 });
            return;
        }
        if (!this.isValidator) {
            this.snackBar.open('Solo las cuentas validadoras pueden añadir nuevos validadores.', 'Cerrar', { duration: 3000 });
            return;
        }
        // Validación de formato de dirección del nuevo validador
        if (!this.newValidatorAddress.startsWith('0x') || this.newValidatorAddress.length !== 42) {
             this.snackBar.open('Por favor, introduce una dirección Ethereum válida para el nuevo validador.', 'Cerrar', { duration: 4000 });
             return;
        }


        this.blockchainService.addValidator(this.newValidatorAddress).subscribe({
            next: (txHash) => {
                this.addValidatorTxHash = txHash;
                this.snackBar.open('Validador añadido! TX: ' + txHash.slice(0, 10) + '...', 'Cerrar', { duration: 5000 });
                this.newValidatorAddress = '';
            },
            error: (err) => {
                console.error("Error al añadir validador:", err);
                this.snackBar.open(`Error al añadir validador: ${err.message || err}`, 'Cerrar', { duration: 5000 });
            }
        });
    }
}