-- MariaDB dump 10.19  Distrib 10.4.32-MariaDB, for Win64 (AMD64)
--
-- Host: localhost    Database: repair_system
-- ------------------------------------------------------
-- Server version	10.4.32-MariaDB

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `approvals`
--

DROP TABLE IF EXISTS `approvals`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `approvals` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `repair_request_id` int(11) NOT NULL,
  `manager_id` int(11) NOT NULL,
  `status` enum('approved','rejected') NOT NULL,
  `note` text DEFAULT NULL COMMENT 'เหตุผล/หมายเหตุ',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `repair_request_id` (`repair_request_id`),
  KEY `manager_id` (`manager_id`),
  CONSTRAINT `approvals_ibfk_1` FOREIGN KEY (`repair_request_id`) REFERENCES `repair_requests` (`id`) ON DELETE CASCADE,
  CONSTRAINT `approvals_ibfk_2` FOREIGN KEY (`manager_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `approvals`
--

LOCK TABLES `approvals` WRITE;
/*!40000 ALTER TABLE `approvals` DISABLE KEYS */;
/*!40000 ALTER TABLE `approvals` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `audit_logs`
--

DROP TABLE IF EXISTS `audit_logs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `audit_logs` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) DEFAULT NULL,
  `username` varchar(100) DEFAULT NULL,
  `action` varchar(100) NOT NULL,
  `details` text DEFAULT NULL,
  `ip_address` varchar(45) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `audit_logs_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=17 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `audit_logs`
--

LOCK TABLES `audit_logs` WRITE;
/*!40000 ALTER TABLE `audit_logs` DISABLE KEYS */;
INSERT INTO `audit_logs` VALUES (1,1,'admin','login','User admin (admin) logged in','::1','2026-07-16 02:33:43'),(2,1,'admin','login','User admin (admin) logged in','::1','2026-07-16 03:01:08'),(3,1,'admin','login','User admin (admin) logged in','::1','2026-07-16 03:31:55'),(4,1,'admin','login','User admin (admin) logged in','::1','2026-07-16 05:01:23'),(5,1,'admin','login','User admin (admin) logged in','::1','2026-07-16 05:23:06'),(6,1,'admin','login','User admin (admin) logged in','::1','2026-07-16 05:43:22'),(7,1,'admin','login','User admin (admin) logged in','::1','2026-07-16 05:55:51'),(8,3,'user','login','User user (user) logged in','::1','2026-07-16 05:56:22'),(9,3,'user','login','User user (user) logged in','::1','2026-07-16 06:04:50'),(10,3,'user','login','User user (user) logged in','::1','2026-07-16 06:15:56'),(11,3,'user','login','User user (user) logged in','::1','2026-07-16 06:45:51'),(12,3,'user','login','User user (user) logged in','::1','2026-07-16 06:55:26'),(13,3,'user','login','User user (user) logged in','::1','2026-07-16 08:22:38'),(14,3,'user','login','User user (user) logged in','::1','2026-07-16 08:24:56'),(15,1,'admin','login','User admin (admin) logged in','::1','2026-07-16 08:38:52'),(16,1,'admin','update_equipment','Updated equipment id=9','::1','2026-07-16 08:39:03');
/*!40000 ALTER TABLE `audit_logs` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `departments`
--

DROP TABLE IF EXISTS `departments`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `departments` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(100) NOT NULL,
  `description` text DEFAULT NULL,
  `manager_id` int(11) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `manager_id` (`manager_id`),
  CONSTRAINT `departments_ibfk_1` FOREIGN KEY (`manager_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `departments`
--

LOCK TABLES `departments` WRITE;
/*!40000 ALTER TABLE `departments` DISABLE KEYS */;
/*!40000 ALTER TABLE `departments` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `equipment`
--

DROP TABLE IF EXISTS `equipment`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `equipment` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `equipment_code` varchar(100) NOT NULL,
  `equipment_name` varchar(200) NOT NULL,
  `equipment_type_id` int(11) NOT NULL,
  `location_building` varchar(100) DEFAULT NULL,
  `location_department` varchar(100) DEFAULT NULL,
  `location_room` varchar(100) DEFAULT NULL,
  `status` enum('active','inactive') DEFAULT 'active',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `equipment_code` (`equipment_code`),
  KEY `equipment_type_id` (`equipment_type_id`),
  CONSTRAINT `equipment_ibfk_1` FOREIGN KEY (`equipment_type_id`) REFERENCES `equipment_types` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=47 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `equipment`
--

LOCK TABLES `equipment` WRITE;
/*!40000 ALTER TABLE `equipment` DISABLE KEYS */;
INSERT INTO `equipment` VALUES (6,'COM-001','คอมพิวเตอร์ Dell Optiplex 3510',1,'อาคารผู้ป่วยนอก','ฝ่ายการเงิน','101','active','2026-07-09 08:02:46','2026-07-09 08:02:46'),(7,'COM-002','คอมพิวเตอร์ Lenovo ThinkCentre 400 G7',1,'อาคาร B','ฝ่ายการพยาบาล','105','active','2026-07-09 08:02:46','2026-07-09 08:02:46'),(8,'COM-003','คอมพิวเตอร์ Lenovo ThinkCentre 400 G7',1,'อาคารอำนวยการ','ฝ่ายเภสัช','103','active','2026-07-09 08:02:46','2026-07-09 08:02:46'),(9,'COM-004','คอมพิวเตอร์ Dell Inspiron 400 G7',1,'อาคาร C','ฝ่ายไอที','102','active','2026-07-09 08:02:46','2026-07-09 08:02:46'),(10,'COM-005','คอมพิวเตอร์ Acer Veriton M720q',1,'อาคารผู้ป่วยนอก','ฝ่ายเภสัช','302','active','2026-07-09 08:02:46','2026-07-09 08:02:46'),(11,'COM-006','คอมพิวเตอร์ Lenovo IdeaCentre Ryzen5',1,'อาคารผู้ป่วยนอก','ฝ่ายไอที','106','active','2026-07-09 08:02:46','2026-07-09 08:02:46'),(12,'COM-007','คอมพิวเตอร์ Dell Inspiron 800 G6',1,'อาคาร D','งานซ่อมบำรุง','201','active','2026-07-09 08:02:46','2026-07-09 08:02:46'),(13,'COM-008','คอมพิวเตอร์ HP EliteDesk M720q',1,'อาคาร A','ฝ่ายการพยาบาล','402','active','2026-07-09 08:02:46','2026-07-09 08:02:46'),(14,'COM-009','คอมพิวเตอร์ Dell Optiplex TC-1760',1,'อาคาร A','ห้องปฏิบัติการ','203','active','2026-07-09 08:02:46','2026-07-09 08:02:46'),(15,'COM-010','คอมพิวเตอร์ Acer Veriton TC-1760',1,'อาคารผู้ป่วยนอก','ฝ่ายการเงิน','B01','active','2026-07-09 08:02:46','2026-07-09 08:02:46'),(16,'COP-001','เครื่องถ่ายเอกสาร Xerox MX-4070N',2,'อาคาร D','ฝ่ายเภสัช','101','active','2026-07-09 08:02:46','2026-07-09 08:02:46'),(17,'COP-002','เครื่องถ่ายเอกสาร Sharp MX-4070N',2,'อาคาร B','สำนักงานกลาง','B02','active','2026-07-09 08:02:46','2026-07-09 08:02:46'),(18,'COP-003','เครื่องถ่ายเอกสาร Ricoh WorkCentre 6515',2,'อาคาร D','สำนักงานกลาง','B02','active','2026-07-09 08:02:46','2026-07-09 08:02:46'),(19,'COP-004','เครื่องถ่ายเอกสาร Kyocera MFC-L6900DW',2,'อาคาร D','งานซ่อมบำรุง','302','active','2026-07-09 08:02:46','2026-07-09 08:02:46'),(20,'COP-005','เครื่องถ่ายเอกสาร HP LaserJet WorkCentre 6515',2,'อาคาร D','สำนักงานกลาง','203','active','2026-07-09 08:02:46','2026-07-09 08:02:46'),(21,'COP-006','เครื่องถ่ายเอกสาร Toshiba bizhub C300i',2,'อาคาร D','งานซ่อมบำรุง','105','active','2026-07-09 08:02:46','2026-07-09 08:02:46'),(22,'COP-007','เครื่องถ่ายเอกสาร Toshiba iR-ADV C3520',2,'อาคารอำนวยการ','ฝ่ายบุคคล','B02','active','2026-07-09 08:02:46','2026-07-09 08:02:46'),(23,'COP-008','เครื่องถ่ายเอกสาร Sharp MFP M479fdw',2,'อาคาร B','ห้องปฏิบัติการ','201','active','2026-07-09 08:02:46','2026-07-09 08:02:46'),(24,'COP-009','เครื่องถ่ายเอกสาร Canon TASKalfa 3051ci',2,'อาคาร C','ฝ่ายการพยาบาล','102','active','2026-07-09 08:02:46','2026-07-09 08:02:46'),(25,'COP-010','เครื่องถ่ายเอกสาร Samsung MFP M479fdw',2,'อาคาร C','ฝ่ายรังสี','201','active','2026-07-09 08:02:46','2026-07-09 08:02:46'),(26,'UPS-001','UPS Delta UPS-2000VA',3,'อาคาร A','ห้องปฏิบัติการ','106','active','2026-07-09 08:02:46','2026-07-09 08:02:46'),(27,'UPS-002','UPS Delta CP1500AVRLCD',3,'อาคาร D','ฝ่ายรังสี','201','active','2026-07-09 08:02:46','2026-07-09 08:02:46'),(28,'UPS-003','UPS Delta BR1500GI',3,'อาคารผู้ป่วยนอก','ฝ่ายเวชระเบียน','B01','active','2026-07-09 08:02:46','2026-07-09 08:02:46'),(29,'UPS-004','UPS Delta SMART1500LCD',3,'อาคารอำนวยการ','ฝ่ายรังสี','401','active','2026-07-09 08:02:46','2026-07-09 08:02:46'),(30,'UPS-005','UPS CyberPower 1500VA',3,'อาคารผู้ป่วยนอก','ฝ่ายรังสี','201','active','2026-07-09 08:02:46','2026-07-09 08:02:46'),(31,'UPS-006','UPS Schneider CP1500AVRLCD',3,'อาคารอำนวยการ','ห้องปฏิบัติการ','401','active','2026-07-09 08:02:46','2026-07-09 08:02:46'),(32,'UPS-007','UPS CyberPower SUA1500I',3,'อาคาร A','งานซ่อมบำรุง','105','active','2026-07-09 08:02:46','2026-07-09 08:02:46'),(33,'UPS-008','UPS APC CP1500AVRLCD',3,'อาคาร C','ฝ่ายบุคคล','B02','active','2026-07-09 08:02:46','2026-07-09 08:02:46'),(34,'UPS-009','UPS Vertiv UPS-2000VA',3,'อาคาร A','ห้องปฏิบัติการ','202','active','2026-07-09 08:02:46','2026-07-09 08:02:46'),(35,'UPS-010','UPS Vertiv CP1500AVRLCD',3,'อาคาร B','ฝ่ายเภสัช','203','active','2026-07-09 08:02:46','2026-07-09 08:02:46'),(36,'RTR-001','Router TP-Link TL-ER7206',4,'อาคาร A','งานซ่อมบำรุง','301','active','2026-07-09 08:02:46','2026-07-09 08:02:46'),(37,'RTR-002','Router Cisco RV340',4,'อาคาร D','ฝ่ายไอที','101','active','2026-07-09 08:02:46','2026-07-09 08:02:46'),(38,'RTR-003','Router Asus AR1220E',4,'อาคารอำนวยการ','ฝ่ายรังสี','B01','active','2026-07-09 08:02:46','2026-07-09 08:02:46'),(39,'RTR-004','Router Cisco RB4011',4,'อาคารอำนวยการ','ห้องปฏิบัติการ','102','active','2026-07-09 08:02:46','2026-07-09 08:02:46'),(40,'RTR-005','Router Asus AR1220E',4,'อาคารอำนวยการ','ฝ่ายเภสัช','B02','active','2026-07-09 08:02:46','2026-07-09 08:02:46'),(41,'RTR-006','Router Juniper DSR-1000AC',4,'อาคาร B','ฝ่ายไอที','301','active','2026-07-09 08:02:46','2026-07-09 08:02:46'),(42,'RTR-007','Router Juniper USG Flex 200',4,'อาคาร C','ฝ่ายการเงิน','105','active','2026-07-09 08:02:46','2026-07-09 08:02:46'),(43,'RTR-008','Router Juniper AR1220E',4,'อาคาร D','สำนักงานกลาง','102','active','2026-07-09 08:02:46','2026-07-09 08:02:46'),(44,'RTR-009','Router Cisco RT-AC88U',4,'อาคารผู้ป่วยนอก','ฝ่ายรังสี','105','active','2026-07-09 08:02:46','2026-07-09 08:02:46'),(45,'RTR-010','Router Asus SRX300',4,'อาคาร A','ฝ่ายเวชระเบียน','102','active','2026-07-09 08:02:46','2026-07-09 08:02:46');
/*!40000 ALTER TABLE `equipment` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `equipment_parts`
--

DROP TABLE IF EXISTS `equipment_parts`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `equipment_parts` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `equipment_type_id` int(11) NOT NULL,
  `part_name` varchar(100) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `equipment_type_id` (`equipment_type_id`),
  CONSTRAINT `equipment_parts_ibfk_1` FOREIGN KEY (`equipment_type_id`) REFERENCES `equipment_types` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=15 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `equipment_parts`
--

LOCK TABLES `equipment_parts` WRITE;
/*!40000 ALTER TABLE `equipment_parts` DISABLE KEYS */;
INSERT INTO `equipment_parts` VALUES (1,1,'CPU'),(2,1,'เมนบอร์ด'),(3,1,'RAM'),(4,1,'SSD'),(5,1,'HDD'),(6,1,'จอคอมพิวเตอร์'),(7,1,'PSU (Power Supply)'),(8,1,'CPU'),(9,1,'เมนบอร์ด'),(10,1,'RAM'),(11,1,'SSD'),(12,1,'HDD'),(13,1,'จอคอมพิวเตอร์'),(14,1,'PSU (Power Supply)');
/*!40000 ALTER TABLE `equipment_parts` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `equipment_types`
--

DROP TABLE IF EXISTS `equipment_types`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `equipment_types` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(100) NOT NULL,
  `description` text DEFAULT NULL,
  `has_parts` tinyint(1) DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=9 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `equipment_types`
--

LOCK TABLES `equipment_types` WRITE;
/*!40000 ALTER TABLE `equipment_types` DISABLE KEYS */;
INSERT INTO `equipment_types` VALUES (1,'คอมพิวเตอร์','คอมพิวเตอร์ตั้งโต๊ะและอุปกรณ์เสริม',1,'2026-07-08 02:35:09'),(2,'เครื่องถ่ายเอกสาร','เครื่องถ่ายเอกสาร/ปริ้นเตอร์',0,'2026-07-08 02:35:09'),(3,'UPS','เครื่องสำรองไฟฟ้า',0,'2026-07-08 02:35:09'),(4,'Router','อุปกรณ์เครือข่าย Router/Switch',0,'2026-07-08 02:35:09');
/*!40000 ALTER TABLE `equipment_types` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `notifications`
--

DROP TABLE IF EXISTS `notifications`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `notifications` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL,
  `title` varchar(200) NOT NULL,
  `message` text NOT NULL,
  `type` enum('info','success','warning','error') DEFAULT 'info',
  `related_type` varchar(50) DEFAULT NULL,
  `related_id` int(11) DEFAULT NULL,
  `is_read` tinyint(1) DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `notifications_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `notifications`
--

LOCK TABLES `notifications` WRITE;
/*!40000 ALTER TABLE `notifications` DISABLE KEYS */;
/*!40000 ALTER TABLE `notifications` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `ratings`
--

DROP TABLE IF EXISTS `ratings`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `ratings` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `repair_request_id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `rating` tinyint(4) NOT NULL CHECK (`rating` >= 1 and `rating` <= 5),
  `comment` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_repair_rating` (`repair_request_id`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `ratings_ibfk_1` FOREIGN KEY (`repair_request_id`) REFERENCES `repair_requests` (`id`) ON DELETE CASCADE,
  CONSTRAINT `ratings_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `ratings`
--

LOCK TABLES `ratings` WRITE;
/*!40000 ALTER TABLE `ratings` DISABLE KEYS */;
/*!40000 ALTER TABLE `ratings` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `repair_requests`
--

DROP TABLE IF EXISTS `repair_requests`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `repair_requests` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `ticket_number` varchar(20) NOT NULL,
  `equipment_id` int(11) NOT NULL,
  `equipment_parts` text DEFAULT NULL,
  `problem_description` text NOT NULL,
  `requester_name` varchar(200) NOT NULL,
  `user_id` int(11) DEFAULT NULL,
  `location_building` varchar(100) NOT NULL,
  `location_department` varchar(100) NOT NULL,
  `location_room` varchar(100) NOT NULL,
  `priority` enum('urgent','normal','low') DEFAULT 'normal',
  `image_path` varchar(500) DEFAULT NULL,
  `status` varchar(50) DEFAULT 'pending',
  `admin_note` text DEFAULT NULL,
  `requested_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `completed_at` timestamp NULL DEFAULT NULL,
  `department_id` int(11) DEFAULT NULL,
  `approved_by` int(11) DEFAULT NULL,
  `approved_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `ticket_number` (`ticket_number`),
  KEY `equipment_id` (`equipment_id`),
  CONSTRAINT `repair_requests_ibfk_1` FOREIGN KEY (`equipment_id`) REFERENCES `equipment` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=14 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `repair_requests`
--

LOCK TABLES `repair_requests` WRITE;
/*!40000 ALTER TABLE `repair_requests` DISABLE KEYS */;
INSERT INTO `repair_requests` VALUES (8,'REP-20260713-6357',15,NULL,'ทดสอบระบบ','พนักงานทั่วไป',3,'อาคารผู้ป่วยนอก','ฝ่ายการเงิน','B01','normal',NULL,'pending',NULL,'2026-07-13 06:45:28','2026-07-13 08:48:11',NULL,NULL,NULL,NULL),(9,'REP-20260713-2026',32,NULL,'ทดสอบระบบ','พนักงานทั่วไป',3,'อาคาร A','งานซ่อมบำรุง','105','normal',NULL,'pending',NULL,'2026-07-13 06:48:14','2026-07-13 08:48:11',NULL,NULL,NULL,NULL),(10,'REP-20260713-4275',37,NULL,'ทดสอบระบบ','พนักงานทั่วไป',3,'อาคาร D','ฝ่ายไอที','101','normal',NULL,'pending',NULL,'2026-07-13 06:48:26','2026-07-13 08:48:11',NULL,NULL,NULL,NULL),(11,'REP-20260713-2580',18,NULL,'ทดสอบระบบ','พนักงานทั่วไป',3,'อาคาร D','สำนักงานกลาง','B02','normal',NULL,'pending',NULL,'2026-07-13 06:48:41','2026-07-13 08:48:11',NULL,NULL,NULL,NULL),(12,'REP-20260713-4697',29,NULL,'ทดสอบระบบ','พนักงานทั่วไป',3,'อาคารอำนวยการ','ฝ่ายรังสี','401','normal',NULL,'completed',NULL,'2026-07-13 06:49:38','2026-07-13 08:48:11','2026-07-13 08:43:07',NULL,NULL,NULL),(13,'REP-20260713-9216',10,NULL,'ทดสอบระบบ','พนักงานทั่วไป',3,'อาคารผู้ป่วยนอก','ฝ่ายเภสัช','302','normal',NULL,'completed',NULL,'2026-07-13 06:50:14','2026-07-13 08:53:22','2026-07-13 08:53:22',NULL,NULL,NULL);
/*!40000 ALTER TABLE `repair_requests` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `status_history`
--

DROP TABLE IF EXISTS `status_history`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `status_history` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `repair_request_id` int(11) NOT NULL,
  `old_status` varchar(50) DEFAULT NULL,
  `new_status` varchar(50) NOT NULL,
  `changed_by` int(11) DEFAULT NULL,
  `note` text DEFAULT NULL,
  `changed_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `repair_request_id` (`repair_request_id`),
  KEY `changed_by` (`changed_by`),
  CONSTRAINT `status_history_ibfk_1` FOREIGN KEY (`repair_request_id`) REFERENCES `repair_requests` (`id`) ON DELETE CASCADE,
  CONSTRAINT `status_history_ibfk_2` FOREIGN KEY (`changed_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=20 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `status_history`
--

LOCK TABLES `status_history` WRITE;
/*!40000 ALTER TABLE `status_history` DISABLE KEYS */;
INSERT INTO `status_history` VALUES (9,8,NULL,'pending',NULL,'สร้างคำแจ้งซ่อมใหม่','2026-07-13 06:45:28'),(10,9,NULL,'pending',NULL,'สร้างคำแจ้งซ่อมใหม่','2026-07-13 06:48:14'),(11,10,NULL,'pending',NULL,'สร้างคำแจ้งซ่อมใหม่','2026-07-13 06:48:26'),(12,11,NULL,'pending',NULL,'สร้างคำแจ้งซ่อมใหม่','2026-07-13 06:48:41'),(13,12,NULL,'pending',NULL,'สร้างคำแจ้งซ่อมใหม่','2026-07-13 06:49:38'),(14,13,NULL,'pending',NULL,'สร้างคำแจ้งซ่อมใหม่','2026-07-13 06:50:14'),(15,13,'pending','pending',1,NULL,'2026-07-13 07:52:47'),(16,13,'pending','completed',1,NULL,'2026-07-13 07:53:13'),(17,12,'pending','completed',1,NULL,'2026-07-13 08:43:07'),(18,13,'completed','completed',1,NULL,'2026-07-13 08:51:16'),(19,13,'completed','completed',1,NULL,'2026-07-13 08:53:22');
/*!40000 ALTER TABLE `status_history` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `users`
--

DROP TABLE IF EXISTS `users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `users` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `username` varchar(100) NOT NULL,
  `password` varchar(255) NOT NULL,
  `full_name` varchar(200) NOT NULL,
  `email` varchar(200) DEFAULT NULL,
  `telegram_chat_id` varchar(50) DEFAULT NULL,
  `line_user_id` varchar(50) DEFAULT NULL,
  `role` enum('admin','manager','user') DEFAULT 'user',
  `status` enum('active','inactive') DEFAULT 'active',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `username` (`username`),
  UNIQUE KEY `uk_line_user_id` (`line_user_id`)
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `users`
--

LOCK TABLES `users` WRITE;
/*!40000 ALTER TABLE `users` DISABLE KEYS */;
INSERT INTO `users` VALUES (1,'admin','$2b$10$7R1EqOMcRlvO7rtyr8o4/elrGUJhpnRFjaAHZAC3Xia8MPPI/E6PG','ผู้ดูแลระบบ','harofanlantam2@gmail.com',NULL,NULL,'admin','active','2026-07-08 02:35:09','2026-07-13 02:56:41'),(3,'user','$2b$10$qWgeEk3YD.dyNe8Kk6iy8emlX1smZox.S8oM3fkp/JNMINVIS/GC6','พนักงานทั่วไป','koloboqq99@gmail.com',NULL,NULL,'user','active','2026-07-09 04:18:05','2026-07-13 08:48:11'),(4,'manager','$2b$10$9PF72qNOXqui8yz9Y6UOnujLHJXtZDY0gQbujkgrYQcYi4DsRBljG','ผู้จัดการ',NULL,NULL,NULL,'manager','active','2026-07-09 04:18:05','2026-07-09 04:18:05');
/*!40000 ALTER TABLE `users` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Dumping routines for database 'repair_system'
--
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-07-16 15:44:29
