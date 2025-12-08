import { expect } from "chai";
import { ethers } from "hardhat";
import { BatchTraceability } from "../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

describe("BatchTraceability", function () {
  
  let batchTrace: BatchTraceability;
  let owner: HardhatEthersSigner;
  let operator1: HardhatEthersSigner;
  let operator2: HardhatEthersSigner;
  let unauthorized: HardhatEthersSigner;
  
  // Datos de teste
  const EPC_1 = "urn:epc:id:sgtin:789.12345.LOTE-2025-001";
  const EPC_2 = "urn:epc:id:sgtin:789.12345.LOTE-2025-002";
  const CERTIFICATE_TOKEN_ID = 123;
  const EPCIS_HASH = ethers.id("mock-epcis-xml-content"); // Mock hash
  
  beforeEach(async function () {
    [owner, operator1, operator2, unauthorized] = await ethers.getSigners();
    
    // Deploy contract
    const BatchTraceFactory = await ethers.getContractFactory("BatchTraceability");
    batchTrace = await BatchTraceFactory.deploy();
    await batchTrace.waitForDeployment();
    
    // Autorizar operator1
    await batchTrace.authorizeOperator(operator1.address);
  });

  describe("Deployment", function () {
    it("Should set the right owner", async function () {
      expect(await batchTrace.owner()).to.equal(owner.address);
    });
    
    it("Should start with 0 operations", async function () {
      expect(await batchTrace.totalOperations()).to.equal(0);
    });
    
    it("Should have owner as authorized operator", async function () {
      expect(await batchTrace.isAuthorizedOperator(owner.address)).to.be.true;
    });
  });

  describe("Access Control", function () {
    it("Should authorize operator correctly", async function () {
      expect(await batchTrace.authorizedOperators(operator1.address)).to.be.true;
      expect(await batchTrace.isAuthorizedOperator(operator1.address)).to.be.true;
    });
    
    it("Should emit OperatorAuthorized event", async function () {
      await expect(
        batchTrace.authorizeOperator(operator2.address)
      ).to.emit(batchTrace, "OperatorAuthorized")
        .withArgs(operator2.address, owner.address, await ethers.provider.getBlock('latest').then(b => b!.timestamp + 1));
    });
    
    it("Should fail to authorize if not owner", async function () {
      await expect(
        batchTrace.connect(unauthorized).authorizeOperator(unauthorized.address)
      ).to.be.reverted;
    });
    
    it("Should fail to authorize zero address", async function () {
      await expect(
        batchTrace.authorizeOperator(ethers.ZeroAddress)
      ).to.be.revertedWith("Invalid address");
    });
    
    it("Should fail to authorize already authorized", async function () {
      await expect(
        batchTrace.authorizeOperator(operator1.address)
      ).to.be.revertedWith("Already authorized");
    });
    
    it("Should revoke operator correctly", async function () {
      await batchTrace.revokeOperator(operator1.address);
      expect(await batchTrace.authorizedOperators(operator1.address)).to.be.false;
    });
    
    it("Should emit OperatorRevoked event", async function () {
      await expect(
        batchTrace.revokeOperator(operator1.address)
      ).to.emit(batchTrace, "OperatorRevoked")
        .withArgs(operator1.address, owner.address, await ethers.provider.getBlock('latest').then(b => b!.timestamp + 1));
    });
    
    it("Should fail to revoke if not authorized", async function () {
      await expect(
        batchTrace.revokeOperator(operator2.address)
      ).to.be.revertedWith("Not authorized");
    });
    
    it("Should authorize multiple operators in batch", async function () {
      const operators = [operator2.address, unauthorized.address];
      
      await batchTrace.authorizeOperatorsBatch(operators);
      
      expect(await batchTrace.isAuthorizedOperator(operator2.address)).to.be.true;
      expect(await batchTrace.isAuthorizedOperator(unauthorized.address)).to.be.true;
    });
  });

  describe("Record Operation", function () {
    it("Should record operation successfully", async function () {
      const tx = await batchTrace.connect(operator1).recordOperation(
        0, // OBJECT
        1, // OBSERVE
        EPC_1,
        CERTIFICATE_TOKEN_ID,
        EPCIS_HASH
      );
      
      await tx.wait();
      
      expect(await batchTrace.totalOperations()).to.equal(1);
    });
    
    it("Should emit OperationRecorded event", async function () {
      await expect(
        batchTrace.connect(operator1).recordOperation(
          0, // OBJECT
          1, // OBSERVE
          EPC_1,
          CERTIFICATE_TOKEN_ID,
          EPCIS_HASH
        )
      ).to.emit(batchTrace, "OperationRecorded")
        .withArgs(
          1, // operationId
          0, // eventType
          EPC_1,
          CERTIFICATE_TOKEN_ID,
          operator1.address,
          EPCIS_HASH,
          await ethers.provider.getBlock('latest').then(b => b!.timestamp + 1)
        );
    });
    
    it("Should store operation data correctly", async function () {
      await batchTrace.connect(operator1).recordOperation(
        0, // OBJECT
        1, // OBSERVE
        EPC_1,
        CERTIFICATE_TOKEN_ID,
        EPCIS_HASH
      );
      
      const op = await batchTrace.getOperation(1);
      
      expect(op.operationId).to.equal(1);
      expect(op.eventType).to.equal(0); // OBJECT
      expect(op.action).to.equal(1); // OBSERVE
      expect(op.epc).to.equal(EPC_1);
      expect(op.certificateTokenId).to.equal(CERTIFICATE_TOKEN_ID);
      expect(op.actor).to.equal(operator1.address);
      expect(op.epcisHash).to.equal(EPCIS_HASH);
    });
    
    it("Should increment operation ID sequentially", async function () {
      await batchTrace.connect(operator1).recordOperation(0, 1, EPC_1, CERTIFICATE_TOKEN_ID, EPCIS_HASH);
      await batchTrace.connect(operator1).recordOperation(0, 1, EPC_2, CERTIFICATE_TOKEN_ID, EPCIS_HASH);
      
      expect(await batchTrace.totalOperations()).to.equal(2);
      
      const op1 = await batchTrace.getOperation(1);
      const op2 = await batchTrace.getOperation(2);
      
      expect(op1.operationId).to.equal(1);
      expect(op2.operationId).to.equal(2);
    });
    
    it("Should fail if not authorized operator", async function () {
      await expect(
        batchTrace.connect(unauthorized).recordOperation(0, 1, EPC_1, CERTIFICATE_TOKEN_ID, EPCIS_HASH)
      ).to.be.revertedWith("Not authorized operator");
    });
    
    it("Should fail if EPC is empty", async function () {
      await expect(
        batchTrace.connect(operator1).recordOperation(0, 1, "", CERTIFICATE_TOKEN_ID, EPCIS_HASH)
      ).to.be.revertedWith("EPC required");
    });
    
    it("Should fail if EPCIS hash is zero", async function () {
      await expect(
        batchTrace.connect(operator1).recordOperation(0, 1, EPC_1, CERTIFICATE_TOKEN_ID, ethers.ZeroHash)
      ).to.be.revertedWith("EPCIS hash required");
    });
    
    it("Should allow owner to record operations", async function () {
      await batchTrace.connect(owner).recordOperation(0, 1, EPC_1, CERTIFICATE_TOKEN_ID, EPCIS_HASH);
      
      expect(await batchTrace.totalOperations()).to.equal(1);
    });
  });

  describe("EPCIS Event Types", function () {
    it("Should record OBJECT event", async function () {
      await batchTrace.connect(operator1).recordOperation(
        0, // OBJECT
        1, // OBSERVE
        EPC_1,
        CERTIFICATE_TOKEN_ID,
        EPCIS_HASH
      );
      
      const op = await batchTrace.getOperation(1);
      expect(op.eventType).to.equal(0); // OBJECT
    });
    
    it("Should record AGGREGATION event", async function () {
      await batchTrace.connect(operator1).recordOperation(
        1, // AGGREGATION
        0, // ADD
        EPC_1,
        CERTIFICATE_TOKEN_ID,
        EPCIS_HASH
      );
      
      const op = await batchTrace.getOperation(1);
      expect(op.eventType).to.equal(1); // AGGREGATION
    });
    
    it("Should record TRANSACTION event", async function () {
      await batchTrace.connect(operator1).recordOperation(
        2, // TRANSACTION
        0, // ADD
        EPC_1,
        CERTIFICATE_TOKEN_ID,
        EPCIS_HASH
      );
      
      const op = await batchTrace.getOperation(1);
      expect(op.eventType).to.equal(2); // TRANSACTION
    });
    
    it("Should record TRANSFORMATION event", async function () {
      await batchTrace.connect(operator1).recordOperation(
        3, // TRANSFORMATION
        0, // ADD
        EPC_1,
        CERTIFICATE_TOKEN_ID,
        EPCIS_HASH
      );
      
      const op = await batchTrace.getOperation(1);
      expect(op.eventType).to.equal(3); // TRANSFORMATION
    });
    
    it("Should record ASSOCIATION event", async function () {
      await batchTrace.connect(operator1).recordOperation(
        4, // ASSOCIATION
        0, // ADD
        EPC_1,
        CERTIFICATE_TOKEN_ID,
        EPCIS_HASH
      );
      
      const op = await batchTrace.getOperation(1);
      expect(op.eventType).to.equal(4); // ASSOCIATION
    });
  });

  describe("EPCIS Actions", function () {
    it("Should record ADD action", async function () {
      await batchTrace.connect(operator1).recordOperation(0, 0, EPC_1, CERTIFICATE_TOKEN_ID, EPCIS_HASH);
      
      const op = await batchTrace.getOperation(1);
      expect(op.action).to.equal(0); // ADD
    });
    
    it("Should record OBSERVE action", async function () {
      await batchTrace.connect(operator1).recordOperation(0, 1, EPC_1, CERTIFICATE_TOKEN_ID, EPCIS_HASH);
      
      const op = await batchTrace.getOperation(1);
      expect(op.action).to.equal(1); // OBSERVE
    });
    
    it("Should record DELETE action", async function () {
      await batchTrace.connect(operator1).recordOperation(0, 2, EPC_1, CERTIFICATE_TOKEN_ID, EPCIS_HASH);
      
      const op = await batchTrace.getOperation(1);
      expect(op.action).to.equal(2); // DELETE
    });
  });

  describe("Hash Verification", function () {
    beforeEach(async function () {
      await batchTrace.connect(operator1).recordOperation(0, 1, EPC_1, CERTIFICATE_TOKEN_ID, EPCIS_HASH);
    });
    
    it("Should verify correct hash", async function () {
      const isValid = await batchTrace.verifyHash(1, EPCIS_HASH);
      expect(isValid).to.be.true;
    });
    
    it("Should reject incorrect hash", async function () {
      const wrongHash = ethers.id("wrong-content");
      const isValid = await batchTrace.verifyHash(1, wrongHash);
      expect(isValid).to.be.false;
    });
    
    it("Should fail to verify non-existent operation", async function () {
      await expect(
        batchTrace.verifyHash(999, EPCIS_HASH)
      ).to.be.revertedWith("Invalid operation ID");
    });
  });

  describe("View Functions", function () {
    beforeEach(async function () {
      await batchTrace.connect(operator1).recordOperation(0, 1, EPC_1, CERTIFICATE_TOKEN_ID, EPCIS_HASH);
      await batchTrace.connect(operator1).recordOperation(1, 0, EPC_2, CERTIFICATE_TOKEN_ID, EPCIS_HASH);
    });
    
    it("Should get operation by ID", async function () {
      const op = await batchTrace.getOperation(1);
      expect(op.epc).to.equal(EPC_1);
    });
    
    it("Should fail to get invalid operation ID", async function () {
      await expect(
        batchTrace.getOperation(999)
      ).to.be.revertedWith("Invalid operation ID");
    });
    
    it("Should return correct total operations", async function () {
      expect(await batchTrace.totalOperations()).to.equal(2);
    });
  });

  describe("Multiple Operators Scenario", function () {
    beforeEach(async function () {
      await batchTrace.authorizeOperator(operator2.address);
    });
    
    it("Should allow multiple operators to record", async function () {
      await batchTrace.connect(operator1).recordOperation(0, 1, EPC_1, CERTIFICATE_TOKEN_ID, EPCIS_HASH);
      await batchTrace.connect(operator2).recordOperation(0, 1, EPC_2, CERTIFICATE_TOKEN_ID, EPCIS_HASH);
      
      expect(await batchTrace.totalOperations()).to.equal(2);
      
      const op1 = await batchTrace.getOperation(1);
      const op2 = await batchTrace.getOperation(2);
      
      expect(op1.actor).to.equal(operator1.address);
      expect(op2.actor).to.equal(operator2.address);
    });
  });
});