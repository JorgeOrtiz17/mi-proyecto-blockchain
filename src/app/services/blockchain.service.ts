import { Injectable, NgZone } from '@angular/core';
import { ethers, BrowserProvider, Signer } from 'ethers';
import { BehaviorSubject, from, Observable, of } from 'rxjs';
import { catchError, map, switchMap, tap } from 'rxjs/operators';

// ¡IMPORTANTE! Actualiza este ABI con el de tu contrato compilado
// Lo encontrarás en `artifacts/contracts/IdentityManager.json` (si usas Hardhat)
// o en `build/contracts/IdentityManager.json` (si usas Truffle)
const IDENTITY_MANAGER_ABI = [
    // Copia el array ABI de tu archivo JSON compilado aquí
    // Ejemplo de cómo se vería una parte del ABI (ya te la proporcioné antes):
    {
        "inputs": [],
        "stateMutability": "nonpayable",
        "type": "constructor"
    },
    {
        "anonymous": false,
        "inputs": [
            {
                "indexed": true,
                "internalType": "address",
                "name": "studentAddress",
                "type": "address"
            },
            {
                "indexed": false,
                "internalType": "string",
                "name": "name",
                "type": "string"
            },
            {
                "indexed": false,
                "internalType": "string",
                "name": "studentIDHash",
                "type": "string"
            }
        ],
        "name": "IdentityRegistered",
        "type": "event"
    },
    {
        "anonymous": false,
        "inputs": [
            {
                "indexed": true,
                "internalType": "address",
                "name": "studentAddress",
                "type": "address"
            },
            {
                "indexed": true,
                "internalType": "address",
                "name": "validatorAddress",
                "type": "address"
            }
        ],
        "name": "IdentityValidated",
        "type": "event"
    },
    {
        "anonymous": false,
        "inputs": [
            {
                "indexed": true,
                "internalType": "address",
                "name": "newValidator",
                "type": "address"
            },
            {
                "indexed": true,
                "internalType": "address",
                "name": "addedBy",
                "type": "address"
            }
        ],
        "name": "ValidatorAdded",
        "type": "event"
    },
    {
        "inputs": [
            {
                "internalType": "address",
                "name": "_newValidator",
                "type": "address"
            }
        ],
        "name": "addValidator",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "address",
                "name": "_studentAddress",
                "type": "address"
            }
        ],
        "name": "getStudentIdentity",
        "outputs": [
            {
                "internalType": "string",
                "name": "name",
                "type": "string"
            },
            {
                "internalType": "string",
                "name": "studentIDHash",
                "type": "string"
            },
            {
                "internalType": "bool",
                "name": "isValidated",
                "type": "bool"
            },
            {
                "internalType": "address",
                "name": "validatorAddress",
                "type": "address"
            },
            {
                "internalType": "uint256",
                "name": "registeredAt",
                "type": "uint256"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "address",
                "name": "",
                "type": "address"
            }
        ],
        "name": "isValidator",
        "outputs": [
            {
                "internalType": "bool",
                "name": "",
                "type": "bool"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "string",
                "name": "_name",
                "type": "string"
            },
            {
                "internalType": "string",
                "name": "_studentIDHash",
                "type": "string"
            }
        ],
        "name": "registerStudentIdentity",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "address",
                "name": "",
                "type": "address"
            }
        ],
        "name": "studentIdentities",
        "outputs": [
            {
                "internalType": "string",
                "name": "name",
                "type": "string"
            },
            {
                "internalType": "string",
                "name": "studentIDHash",
                "type": "string"
            },
            {
                "internalType": "bool",
                "name": "isValidated",
                "type": "bool"
            },
            {
                "internalType": "address",
                "name": "validatorAddress",
                "type": "address"
            },
            {
                "internalType": "uint256",
                "name": "registeredAt",
                "type": "uint256"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "address",
                "name": "_studentAddress",
                "type": "address"
            }
        ],
        "name": "validateIdentity",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    }
]; // <--- ¡Asegúrate de pegar el ABI completo aquí!

// ¡IMPORTANTE! Actualiza esta dirección con la dirección de tu contrato desplegado
// Después de desplegar tu contrato en Ganache o una testnet, obtendrás esta dirección.
const CONTRACT_ADDRESS = '0x5FbDB2315678afecb367f032d93F642f64180aa3'; // <-- ¡Actualiza con tu dirección real!

// Interfaz para tipar la respuesta de `getStudentIdentity`
interface StudentIdentity {
    name: string;
    studentIDHash: string;
    isValidated: boolean;
    validatorAddress: string;
    registeredAt: number; // Timestamp Unix en segundos
}

@Injectable({
    providedIn: 'root'
})
export class BlockchainService {
    private provider: BrowserProvider | undefined;
    private signer: Signer | undefined;
    private contract: ethers.Contract | undefined;

    // BehaviorSubject para emitir el estado de la cuenta actual
    private _currentAccount = new BehaviorSubject<string | null>(null);
    currentAccount$: Observable<string | null> = this._currentAccount.asObservable();

    // BehaviorSubject para emitir el estado de conexión a la wallet
    private _isConnected = new BehaviorSubject<boolean>(false);
    isConnected$: Observable<boolean> = this._isConnected.asObservable();

    constructor(private ngZone: NgZone) {
        this.initEthers();
    }

    private async initEthers() {
        // Detecta si MetaMask (u otro proveedor de Ethereum) está inyectado en el navegador
        if ((window as any).ethereum) {
            this.provider = new ethers.BrowserProvider((window as any).ethereum);
            this.setupAccountListeners(); // Configura escuchadores de cambios de cuenta/red
            await this.checkConnectionStatus(); // Verifica el estado inicial de la conexión
        } else {
            console.warn('MetaMask o una wallet Ethereum compatible no detectada. Por favor, instale una.');
            this._isConnected.next(false);
        }
    }

    /**
     * @dev Verifica si ya hay una cuenta conectada al cargar la aplicación.
     * Esto sucede si el usuario ya aprobó la conexión anteriormente.
     */
    private async checkConnectionStatus() {
        if (this.provider) {
            try {
                const accounts = await this.provider.listAccounts(); // Intenta listar cuentas sin solicitar conexión
                if (accounts.length > 0) {
                    this.ngZone.run(() => { // Ejecutar dentro de la zona de Angular para asegurar la detección de cambios
                        this._currentAccount.next(accounts[0].address);
                        this.signer = accounts[0]; // El primer account es el signer por defecto
                        this.contract = new ethers.Contract(CONTRACT_ADDRESS, IDENTITY_MANAGER_ABI, this.signer);
                        this._isConnected.next(true);
                    });
                } else {
                    this.ngZone.run(() => {
                        this._currentAccount.next(null);
                        this._isConnected.next(false);
                    });
                }
            } catch (error) {
                console.error("Error al verificar el estado de conexión:", error);
                this.ngZone.run(() => {
                    this._isConnected.next(false);
                });
            }
        }
    }

    /**
     * @dev Configura escuchadores para cambios de cuenta y red en MetaMask.
     */
    private setupAccountListeners() {
        if ((window as any).ethereum) {
            // Escuchar cambios de cuenta
            (window as any).ethereum.on('accountsChanged', (accounts: string[]) => {
                this.ngZone.run(() => { // Necesario para que Angular detecte los cambios fuera de su zona
                    if (accounts.length === 0) {
                        this._currentAccount.next(null);
                        this._isConnected.next(false);
                        this.signer = undefined;
                        this.contract = undefined;
                        console.log('Wallet desconectada');
                    } else {
                        this._currentAccount.next(accounts[0]);
                        // Obtener el nuevo signer y el contrato con él
                        this.provider?.getSigner(accounts[0]).then(signer => {
                            this.signer = signer;
                            this.contract = new ethers.Contract(CONTRACT_ADDRESS, IDENTITY_MANAGER_ABI, this.signer);
                            this._isConnected.next(true);
                        }).catch(err => console.error("Error al obtener el signer:", err));
                        console.log('Cuenta cambiada a:', accounts[0]);
                    }
                });
            });

            // Escuchar cambios de red (chainId)
            (window as any).ethereum.on('chainChanged', (chainId: string) => {
                this.ngZone.run(() => {
                    console.log('Red cambiada a Chain ID:', chainId);
                    // Re-inicializar para asegurarse de que el provider y el contrato estén en la red correcta
                    this.initEthers();
                });
            });
        }
    }

    /**
     * @dev Conecta la aplicación con la cartera de MetaMask.
     * Solicita al usuario que apruebe la conexión si no lo ha hecho ya.
     * @returns Observable con la dirección de la cuenta conectada.
     */
    connectWallet(): Observable<string | null> {
        return from(this.provider ? this.provider.send("eth_requestAccounts", []) : Promise.reject('MetaMask not detected')).pipe(
            switchMap((accounts: string[]) => {
                if (accounts.length > 0) {
                    // Obtener el signer de la primera cuenta conectada
                    return from(this.provider!.getSigner(accounts[0])).pipe(
                        tap(signer => {
                            this.signer = signer;
                            // Inicializar el contrato con el signer para enviar transacciones
                            this.contract = new ethers.Contract(CONTRACT_ADDRESS, IDENTITY_MANAGER_ABI, this.signer);
                            this._currentAccount.next(accounts[0]);
                            this._isConnected.next(true);
                        }),
                        map(() => accounts[0]) // Emitir la dirección de la cuenta
                    );
                }
                return of(null); // No hay cuentas conectadas
            }),
            catchError((error) => {
                console.error("Error al conectar con MetaMask:", error);
                this._isConnected.next(false);
                return of(null); // Emitir null en caso de error
            })
        );
    }

    /**
     * @dev Registra una nueva identidad de estudiante en el contrato.
     * Requiere que una wallet esté conectada y la transacción se firmará con la cuenta actual.
     * @param name Nombre del estudiante.
     * @param studentIDHash Hash del ID real del estudiante (ej. un hash SHA256 del DNI/cédula).
     * @returns Observable con el hash de la transacción.
     */
    registerStudentIdentity(name: string, studentIDHash: string): Observable<string> {
        if (!this.contract || !this.signer) {
            return from(Promise.reject('Contrato o Signer no inicializado. Por favor, conecte su wallet.'));
        }
        // Llamada a la función `registerStudentIdentity` del Smart Contract
        // Es importante usar la notación de corchetes si hay ambigüedad o si la función es privada en TS pero pública en Solidity
        return from(this.contract['registerStudentIdentity'](name, studentIDHash)).pipe(
            map((tx: ethers.ContractTransactionResponse) => tx.hash), // Mapea la respuesta a solo el hash de la transacción
            catchError((error) => {
                console.error("Error al registrar identidad:", error);
                throw error; // Re-lanza el error para que el componente lo maneje
            })
        );
    }

    /**
     * @dev Valida una identidad de estudiante. Solo puede ser llamado por una cuenta que sea validador.
     * @param studentAddress Dirección del estudiante cuya identidad se va a validar.
     * @returns Observable con el hash de la transacción.
     */
    validateIdentity(studentAddress: string): Observable<string> {
        if (!this.contract || !this.signer) {
            return from(Promise.reject('Contrato o Signer no inicializado. Por favor, conecte su wallet.'));
        }
        // Llamada a la función `validateIdentity` del Smart Contract
        return from(this.contract['validateIdentity'](studentAddress)).pipe(
            map((tx: ethers.ContractTransactionResponse) => tx.hash),
            catchError((error) => {
                console.error("Error al validar identidad:", error);
                throw error;
            })
        );
    }

    /**
     * @dev Obtiene los detalles de una identidad de estudiante de la blockchain.
     * Esta es una función de solo lectura (`view` en Solidity), no consume gas.
     * @param studentAddress Dirección del estudiante a consultar.
     * @returns Observable con los detalles de la identidad tipados con `StudentIdentity`.
     */
    getStudentIdentity(studentAddress: string): Observable<StudentIdentity> {
        if (!this.provider) {
            return from(Promise.reject('Provider no inicializado.'));
        }
        // Para funciones `view`, no necesitamos el signer, solo el provider.
        // Creamos una nueva instancia del contrato solo para llamadas de lectura.
        const readOnlyContract = new ethers.Contract(CONTRACT_ADDRESS, IDENTITY_MANAGER_ABI, this.provider);

        return from(readOnlyContract['getStudentIdentity'](studentAddress)).pipe(
            map((data: any) => {
                // Mapea la respuesta del contrato a la interfaz StudentIdentity
                return {
                    name: data[0],
                    studentIDHash: data[1],
                    isValidated: data[2],
                    validatorAddress: data[3],
                    registeredAt: Number(data[4]) // Convierte BigInt a number para el timestamp
                } as StudentIdentity;
            }),
            catchError((error) => {
                console.error("Error al obtener la identidad del estudiante:", error);
                throw error;
            })
        );
    }

    /**
     * @dev Verifica si la cuenta actualmente conectada es un validador en el contrato.
     * Esta es una función de solo lectura (`view` en Solidity).
     * @returns Observable con un booleano indicando si la cuenta es un validador.
     */
    isCurrentAccountValidator(): Observable<boolean> {
        return this.currentAccount$.pipe(
            switchMap(account => {
                if (!account || !this.provider) { // Usar this.provider para llamadas de solo lectura
                    return of(false);
                }
                const readOnlyContract = new ethers.Contract(CONTRACT_ADDRESS, IDENTITY_MANAGER_ABI, this.provider);
                return from(readOnlyContract['isValidator'](account)).pipe(
                    catchError(() => of(false)) // En caso de error (ej. red no conectada), asumimos que no es validador
                );
            })
        );
    }

    /**
     * @dev Añade una dirección como validador. Solo puede ser llamado por un validador existente.
     * @param newValidatorAddress La dirección de la nueva cuenta que se desea añadir como validador.
     * @returns Observable con el hash de la transacción.
     */
    addValidator(newValidatorAddress: string): Observable<string> {
        if (!this.contract || !this.signer) {
            return from(Promise.reject('Contrato o Signer no inicializado. Por favor, conecte su wallet.'));
        }
        return from(this.contract['addValidator'](newValidatorAddress)).pipe(
            map((tx: ethers.ContractTransactionResponse) => tx.hash),
            catchError((error) => {
                console.error("Error al añadir validador:", error);
                throw error;
            })
        );
    }
}