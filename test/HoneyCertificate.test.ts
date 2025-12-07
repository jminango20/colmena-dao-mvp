import { expect } from "chai";
import { ethers } from "hardhat";
import { HoneyCertificateNFT } from "../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

describe("HoneyCertificateNFT", function () {
  
  let honeyCert: HoneyCertificateNFT;
  let owner: HardhatEthersSigner;
  let entreposto: HardhatEthersSigner;
  let producer: HardhatEthersSigner;
  let unauthorized: HardhatEthersSigner;
  
  // Datos de teste
  const BATCH_ID = "LOTE-2025-001";
  const PRODUCER_ID = "BR-MS-Produtor-001";
  const PRODUCER_NAME = "João da Silva";
  const REGION = "Mato Grosso do Sul";
  const QUANTITY_KG = 150;
  const DOCUMENTS_FOLDER_CID = "QmDocuments123";
  const METADATA_CID = "QmMetadata456";
  const HARVEST_DATE = Math.floor(Date.now() / 1000);
  
  const HONEY_DATA = {
    floralSource: "multifloral",
    color: "amber",
    moisture: 175,  // 17.5%
    hmf: 85,        // 8.5 mg/kg
    apiaryType: 0,  // FIXED
    certificationLevel: 3,  // FEDERAL (SIF)
    certificationNumber: "SIF-12345",
    certifications: "organic,familyFarming"
  };
  
  beforeEach(async function () {
    [owner, entreposto, producer, unauthorized] = await ethers.getSigners();
    
    // Deploy contract
    const HoneyCertFactory = await ethers.getContractFactory("HoneyCertificateNFT");
    honeyCert = await HoneyCertFactory.deploy();
    await honeyCert.waitForDeployment();
    
    // Autoriza entreposto
    await honeyCert.authorizeIssuer(entreposto.address);
  });

  describe("Deployment", function () {
    it("Should set the right name and symbol", async function () {
      expect(await honeyCert.name()).to.equal("HoneyCertificate");
      expect(await honeyCert.symbol()).to.equal("HONEY");
    });
    
    it("Should set the right owner", async function () {
      expect(await honeyCert.owner()).to.equal(owner.address);
    });
    
    it("Should set default IPFS gateway", async function () {
      expect(await honeyCert.getIPFSGateway()).to.equal("ipfs://");
    });
  });

  describe("Authorization", function () {
    it("Should authorize issuer correctly", async function () {
      expect(await honeyCert.authorizedIssuers(entreposto.address)).to.be.true;
    });
    
    it("Should fail to authorize if not owner", async function () {
      await expect(
        honeyCert.connect(unauthorized).authorizeIssuer(unauthorized.address)
      ).to.be.reverted;
    });
    
    it("Should revoke issuer correctly", async function () {
      await honeyCert.revokeIssuer(entreposto.address);
      expect(await honeyCert.authorizedIssuers(entreposto.address)).to.be.false;
    });
  });

  describe("Certificate Issuance", function () {
    it("Should issue certificate successfully", async function () {
      const tx = await honeyCert.connect(entreposto).issueCertificate(
        producer.address,
        BATCH_ID,
        PRODUCER_ID,
        PRODUCER_NAME,
        REGION,
        QUANTITY_KG,
        DOCUMENTS_FOLDER_CID,
        HARVEST_DATE,
        HONEY_DATA,
        METADATA_CID
      );
      
      const receipt = await tx.wait();
      
      // Verifica que NFT fue mintado
      expect(await honeyCert.ownerOf(1)).to.equal(producer.address);
      
      // Verifica total
      expect(await honeyCert.totalCertificates()).to.equal(1);
    });
    
    it("Should emit HoneyCertificateIssued event", async function () {
      await expect(
        honeyCert.connect(entreposto).issueCertificate(
          producer.address,
          BATCH_ID,
          PRODUCER_ID,
          PRODUCER_NAME,
          REGION,
          QUANTITY_KG,
          DOCUMENTS_FOLDER_CID,
          HARVEST_DATE,
          HONEY_DATA,
          METADATA_CID
        )
      ).to.emit(honeyCert, "HoneyCertificateIssued")
        .withArgs(
          1,
          producer.address,
          BATCH_ID,
          HONEY_DATA.certificationLevel,
          METADATA_CID,
          await ethers.provider.getBlock('latest').then(b => b!.timestamp + 1)
        );
    });
    
    it("Should fail if not authorized issuer", async function () {
      await expect(
        honeyCert.connect(unauthorized).issueCertificate(
          producer.address,
          BATCH_ID,
          PRODUCER_ID,
          PRODUCER_NAME,
          REGION,
          QUANTITY_KG,
          DOCUMENTS_FOLDER_CID,
          HARVEST_DATE,
          HONEY_DATA,
          METADATA_CID
        )
      ).to.be.revertedWith("Not authorized issuer");
    });
    
    it("Should fail if batch already exists", async function () {
      // Primero certificado
      await honeyCert.connect(entreposto).issueCertificate(
        producer.address,
        BATCH_ID,
        PRODUCER_ID,
        PRODUCER_NAME,
        REGION,
        QUANTITY_KG,
        DOCUMENTS_FOLDER_CID,
        HARVEST_DATE,
        HONEY_DATA,
        METADATA_CID
      );
      
      // Intentar duplicar
      await expect(
        honeyCert.connect(entreposto).issueCertificate(
          producer.address,
          BATCH_ID,  // Mismo batch ID
          PRODUCER_ID,
          PRODUCER_NAME,
          REGION,
          QUANTITY_KG,
          DOCUMENTS_FOLDER_CID,
          HARVEST_DATE,
          HONEY_DATA,
          METADATA_CID
        )
      ).to.be.revertedWith("Batch already has certificate");
    });
    
    it("Should fail if metadata CID is empty", async function () {
      await expect(
        honeyCert.connect(entreposto).issueCertificate(
          producer.address,
          BATCH_ID,
          PRODUCER_ID,
          PRODUCER_NAME,
          REGION,
          QUANTITY_KG,
          DOCUMENTS_FOLDER_CID,
          HARVEST_DATE,
          HONEY_DATA,
          ""  // Metadata CID vacío
        )
      ).to.be.revertedWith("Metadata CID required");
    });
    
    it("Should fail if floral source is empty", async function () {
      const badHoneyData = { ...HONEY_DATA, floralSource: "" };
      
      await expect(
        honeyCert.connect(entreposto).issueCertificate(
          producer.address,
          BATCH_ID,
          PRODUCER_ID,
          PRODUCER_NAME,
          REGION,
          QUANTITY_KG,
          DOCUMENTS_FOLDER_CID,
          HARVEST_DATE,
          badHoneyData,
          METADATA_CID
        )
      ).to.be.revertedWith("Floral source required");
    });
    
    it("Should fail if moisture is zero", async function () {
      const badHoneyData = { ...HONEY_DATA, moisture: 0 };
      
      await expect(
        honeyCert.connect(entreposto).issueCertificate(
          producer.address,
          BATCH_ID,
          PRODUCER_ID,
          PRODUCER_NAME,
          REGION,
          QUANTITY_KG,
          DOCUMENTS_FOLDER_CID,
          HARVEST_DATE,
          badHoneyData,
          METADATA_CID
        )
      ).to.be.revertedWith("Moisture must be positive");
    });
    
    it("Should fail if has certification but no number", async function () {
      const badHoneyData = { 
        ...HONEY_DATA, 
        certificationLevel: 3,  // FEDERAL
        certificationNumber: ""  // Vacío
      };
      
      await expect(
        honeyCert.connect(entreposto).issueCertificate(
          producer.address,
          BATCH_ID,
          PRODUCER_ID,
          PRODUCER_NAME,
          REGION,
          QUANTITY_KG,
          DOCUMENTS_FOLDER_CID,
          HARVEST_DATE,
          badHoneyData,
          METADATA_CID
        )
      ).to.be.revertedWith("Certification number required");
    });
  });

  describe("Certificate Data Retrieval", function () {
    beforeEach(async function () {
      await honeyCert.connect(entreposto).issueCertificate(
        producer.address,
        BATCH_ID,
        PRODUCER_ID,
        PRODUCER_NAME,
        REGION,
        QUANTITY_KG,
        DOCUMENTS_FOLDER_CID,
        HARVEST_DATE,
        HONEY_DATA,
        METADATA_CID
      );
    });
    
    it("Should return full certificate", async function () {
      const [baseCert, honeySpecific] = await honeyCert.getFullCertificate(1);
      
      expect(baseCert.batchId).to.equal(BATCH_ID);
      expect(baseCert.producerId).to.equal(PRODUCER_ID);
      expect(baseCert.producerName).to.equal(PRODUCER_NAME);
      expect(baseCert.region).to.equal(REGION);
      expect(baseCert.quantity).to.equal(QUANTITY_KG);
      expect(baseCert.documentsFolderCID).to.equal(DOCUMENTS_FOLDER_CID);
      
      expect(honeySpecific.floralSource).to.equal(HONEY_DATA.floralSource);
      expect(honeySpecific.moisture).to.equal(HONEY_DATA.moisture);
      expect(honeySpecific.hmf).to.equal(HONEY_DATA.hmf);
      expect(honeySpecific.certificationNumber).to.equal(HONEY_DATA.certificationNumber);
    });
    
    it("Should return honey data", async function () {
      const honey = await honeyCert.getHoneyData(1);
      
      expect(honey.floralSource).to.equal(HONEY_DATA.floralSource);
      expect(honey.color).to.equal(HONEY_DATA.color);
      expect(honey.moisture).to.equal(HONEY_DATA.moisture);
      expect(honey.hmf).to.equal(HONEY_DATA.hmf);
    });
    
    it("Should return certification level", async function () {
      const level = await honeyCert.getCertificationLevel(1);
      expect(level).to.equal(3); // FEDERAL
    });
    
    it("Should return correct token by batch", async function () {
      const tokenId = await honeyCert.getTokenByBatch(BATCH_ID);
      expect(tokenId).to.equal(1);
    });
    
    it("Should return producer certificates", async function () {
      const certs = await honeyCert.getProducerCertificates(producer.address);
      expect(certs.length).to.equal(1);
      expect(certs[0]).to.equal(1);
    });
  });

  describe("tokenURI & Metadata", function () {
    beforeEach(async function () {
      await honeyCert.connect(entreposto).issueCertificate(
        producer.address,
        BATCH_ID,
        PRODUCER_ID,
        PRODUCER_NAME,
        REGION,
        QUANTITY_KG,
        DOCUMENTS_FOLDER_CID,
        HARVEST_DATE,
        HONEY_DATA,
        METADATA_CID
      );
    });
    
    it("Should return correct tokenURI", async function () {
      const uri = await honeyCert.tokenURI(1);
      expect(uri).to.equal(`ipfs://${METADATA_CID}`);
    });
    
    it("Should return metadata CID", async function () {
      const cid = await honeyCert.getMetadataCID(1);
      expect(cid).to.equal(METADATA_CID);
    });
    
    it("Should fail tokenURI if token does not exist", async function () {
      await expect(
        honeyCert.tokenURI(999)
      ).to.be.revertedWith("Token does not exist");
    });
    
    it("Should update IPFS gateway", async function () {
      const newGateway = "https://ipfs.io/ipfs/";
      
      await expect(
        honeyCert.setIPFSGateway(newGateway)
      ).to.emit(honeyCert, "IPFSGatewayUpdated")
        .withArgs("ipfs://", newGateway, await ethers.provider.getBlock('latest').then(b => b!.timestamp + 1));
      
      expect(await honeyCert.getIPFSGateway()).to.equal(newGateway);
      
      // tokenURI ahora usa nuevo gateway
      const uri = await honeyCert.tokenURI(1);
      expect(uri).to.equal(`${newGateway}${METADATA_CID}`);
    });
    
    it("Should fail to update gateway if not owner", async function () {
      await expect(
        honeyCert.connect(unauthorized).setIPFSGateway("https://example.com/")
      ).to.be.reverted;
    });
  });

  describe("Certification Levels & Export", function () {
    it("Should allow export for SIF certification", async function () {
      const sifData = { ...HONEY_DATA, certificationLevel: 3, certificationNumber: "SIF-12345" };
      
      await honeyCert.connect(entreposto).issueCertificate(
        producer.address,
        BATCH_ID,
        PRODUCER_ID,
        PRODUCER_NAME,
        REGION,
        QUANTITY_KG,
        DOCUMENTS_FOLDER_CID,
        HARVEST_DATE,
        sifData,
        METADATA_CID
      );
      
      expect(await honeyCert.canExport(1)).to.be.true;
    });
    
    it("Should NOT allow export without SIF", async function () {
      const simData = { 
        ...HONEY_DATA, 
        certificationLevel: 1,  // MUNICIPAL
        certificationNumber: "SIM-67890"
      };
      
      await honeyCert.connect(entreposto).issueCertificate(
        producer.address,
        BATCH_ID,
        PRODUCER_ID,
        PRODUCER_NAME,
        REGION,
        QUANTITY_KG,
        DOCUMENTS_FOLDER_CID,
        HARVEST_DATE,
        simData,
        METADATA_CID
      );
      
      expect(await honeyCert.canExport(1)).to.be.false;
    });
    
    it("Should track certification stats", async function () {
      // SIF
      await honeyCert.connect(entreposto).issueCertificate(
        producer.address,
        "BATCH-1",
        PRODUCER_ID,
        PRODUCER_NAME,
        REGION,
        QUANTITY_KG,
        DOCUMENTS_FOLDER_CID,
        HARVEST_DATE,
        { ...HONEY_DATA, certificationLevel: 3, certificationNumber: "SIF-1" },
        METADATA_CID
      );
      
      // SIM
      await honeyCert.connect(entreposto).issueCertificate(
        producer.address,
        "BATCH-2",
        PRODUCER_ID,
        PRODUCER_NAME,
        REGION,
        QUANTITY_KG,
        DOCUMENTS_FOLDER_CID,
        HARVEST_DATE,
        { ...HONEY_DATA, certificationLevel: 1, certificationNumber: "SIM-1" },
        METADATA_CID + "2"
      );
      
      // SIE
      await honeyCert.connect(entreposto).issueCertificate(
        producer.address,
        "BATCH-3",
        PRODUCER_ID,
        PRODUCER_NAME,
        REGION,
        QUANTITY_KG,
        DOCUMENTS_FOLDER_CID,
        HARVEST_DATE,
        { ...HONEY_DATA, certificationLevel: 2, certificationNumber: "SIE-1" },
        METADATA_CID + "3"
      );
      
      const [none, municipal, estadual, federal] = await honeyCert.getCertificationStats();
      
      expect(none).to.equal(0);
      expect(municipal).to.equal(1);
      expect(estadual).to.equal(1);
      expect(federal).to.equal(1);
    });
    
    it("Should return certification level description", async function () {
      expect(await honeyCert.getCertificationLevelDescription(0)).to.equal("Sin certificacion oficial");
      expect(await honeyCert.getCertificationLevelDescription(1)).to.equal("SIM - Municipal");
      expect(await honeyCert.getCertificationLevelDescription(2)).to.equal("SIE - Estadual");
      expect(await honeyCert.getCertificationLevelDescription(3)).to.equal("SIF - Federal");
    });
  });

  describe("Soulbound (Non-transferable)", function () {
    beforeEach(async function () {
      await honeyCert.connect(entreposto).issueCertificate(
        producer.address,
        BATCH_ID,
        PRODUCER_ID,
        PRODUCER_NAME,
        REGION,
        QUANTITY_KG,
        DOCUMENTS_FOLDER_CID,
        HARVEST_DATE,
        HONEY_DATA,
        METADATA_CID
      );
    });
    
    it("Should NOT allow transfer", async function () {
      await expect(
        honeyCert.connect(producer).transferFrom(
          producer.address,
          unauthorized.address,
          1
        )
      ).to.be.revertedWith("Certificate NFTs are non-transferable (soulbound)");
    });
    
    it("Should NOT allow approve", async function () {
      await expect(
        honeyCert.connect(producer).approve(unauthorized.address, 1)
      ).to.be.revertedWith("Certificate NFTs cannot be approved for transfer");
    });
    
    it("Should NOT allow setApprovalForAll", async function () {
      await expect(
        honeyCert.connect(producer).setApprovalForAll(unauthorized.address, true)
      ).to.be.revertedWith("Certificate NFTs cannot be approved for transfer");
    });
  });

  describe("Certificate Revocation", function () {
    beforeEach(async function () {
      await honeyCert.connect(entreposto).issueCertificate(
        producer.address,
        BATCH_ID,
        PRODUCER_ID,
        PRODUCER_NAME,
        REGION,
        QUANTITY_KG,
        DOCUMENTS_FOLDER_CID,
        HARVEST_DATE,
        HONEY_DATA,
        METADATA_CID
      );
    });
    
    it("Should revoke certificate", async function () {
      expect(await honeyCert.isCertificateActive(1)).to.be.true;
      
      await expect(
        honeyCert.revokeCertificate(1, "Quality issue discovered")
      ).to.emit(honeyCert, "CertificateRevoked");
      
      expect(await honeyCert.isCertificateActive(1)).to.be.false;
    });
    
    it("Should fail to revoke if not owner", async function () {
      await expect(
        honeyCert.connect(unauthorized).revokeCertificate(1, "Test")
      ).to.be.reverted;
    });
  });
});